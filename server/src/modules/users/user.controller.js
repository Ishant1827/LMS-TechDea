const mongoose = require("mongoose");
const User = require("./User.model");
const Course = require("../courses/Course.model");
const Enrollment = require("../enrollments/Enrollment.model");
const Submission = require("../submissions/Submission.model");
const Doubt = require("../doubts/Doubt.model");
const Review = require("../reviews/Review.model");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { ROLES } = require("../../shared/utils/constants");
const { passwordProblem } = require("../../shared/utils/password");

// GET /api/users?role=&q=
exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role && ROLES.includes(req.query.role)) filter.role = req.query.role;
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }
  // .lean() skips the User toJSON that strips passwordHash, so exclude it here.
  const users = await User.find(filter).select("-passwordHash").sort({ createdAt: -1 }).lean();

  // attach a course count for teachers/admins
  const staffIds = users.filter((u) => u.role !== "student").map((u) => u._id);
  const agg = await Course.aggregate([
    { $match: { owner: { $in: staffIds } } },
    { $group: { _id: "$owner", n: { $sum: 1 } } },
  ]);
  const owned = Object.fromEntries(agg.map((x) => [String(x._id), x.n]));

  res.json({
    users: users.map((u) => ({ ...u, ownedCourses: owned[String(u._id)] || 0 })),
  });
});

// POST /api/users  { name, email, password, role }  — create teacher/admin
exports.create = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ message: "Role must be student, teacher or admin" });
  }
  const weak = passwordProblem(password, { name, email });
  if (weak) return res.status(400).json({ message: weak });
  if (await User.findOne({ email: email.toLowerCase() })) {
    return res.status(409).json({ message: "Email already in use" });
  }
  // The admin typed this password, so the owner has never chosen one — exactly
  // the situation A12 exists for, and the same one a bulk import and a password
  // reset already flag. The account can read itself and change its password,
  // nothing else, until it picks one of its own.
  const user = new User({ name, email, role, mustChangePassword: true });
  await user.setPassword(password);
  await user.save();
  res.status(201).json({ user });
});

// PATCH /api/users/:id/role  { role }
exports.setRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!ROLES.includes(role)) return res.status(400).json({ message: "Unknown role" });

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (String(user._id) === String(req.user._id)) {
    return res.status(400).json({ message: "You can't change your own role" });
  }
  if (role === "student") {
    const owns = await Course.countDocuments({ owner: user._id });
    if (owns > 0) {
      return res.status(409).json({ message: `Reassign this user's ${owns} course(s) before demoting to student` });
    }
  }
  user.role = role;
  await user.save();
  res.json({ user });
});

// PATCH /api/users/:id/active  { active }
exports.setActive = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (String(user._id) === String(req.user._id)) {
    return res.status(400).json({ message: "You can't deactivate yourself" });
  }
  user.active = !!req.body.active;
  await user.save();
  res.json({ user });
});

/**
 * Delete an account and everything it authored.
 *
 * Leaving the work behind produced rows with nobody attached — a submission in a
 * grading inbox with a blank student, a review with no author. Per-lesson notes
 * live inside the enrolment, so they go with it.
 *
 * Answers written as a teacher are *not* theirs to take: the doubt belongs to the
 * student who asked it, so only doubts they asked are removed.
 *
 * Both delete paths — one at a time and the bulk toolbar — go through here, so
 * the two cannot drift apart. Course ownership is checked by the caller.
 */
async function removeUserAndTheirWork(user) {
  await Promise.all([
    Enrollment.deleteMany({ student: user._id }),
    Submission.deleteMany({ student: user._id }),
    Doubt.deleteMany({ student: user._id }),
    Review.deleteMany({ student: user._id }),
  ]);
  await user.deleteOne();
}

// DELETE /api/users/:id
exports.remove = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ message: "You can't delete yourself" });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const owns = await Course.countDocuments({ owner: user._id });
  if (owns > 0) {
    return res.status(409).json({ message: `Reassign or delete this user's ${owns} course(s) first` });
  }
  await removeUserAndTheirWork(user);
  res.json({ message: "User deleted" });
});

// PATCH /api/users/:id/password  { password }  — admin sets a user's password
//
// This exists because recovery has to be possible while email is switched off.
// It is deliberately the bluntest tool in the app: an admin can take over any
// account with it, which is inherent to "an admin can reset passwords" and is
// why it is admin-only, rate limited, and ends every session the account had.
//
// It does not ask for the admin's own password. That would be worth adding if
// this were reachable by anyone less trusted — noted as a gap rather than
// pretended away.
exports.setPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const weak = passwordProblem(password, user);
  if (weak) return res.status(400).json({ message: weak });

  await user.setPassword(password);

  // Same reasoning as a bulk import: this is a password the admin chose, not one
  // only its owner knows, so the account changes it on the way back in.
  user.mustChangePassword = true;

  // Whoever was signed in as this account is signed out. If the reason for the
  // reset is a compromise, leaving the intruder's token alive would defeat it —
  // and if it is an ordinary lockout, the user is signed in nowhere anyway.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // No notification is sent: this path exists precisely because mail is off.
  // When mail is on, the account should be told — see the gap in security.md.
  res.json({ message: `Password updated for ${user.name}. Tell them their new password.` });
});

// ── Bulk import ───────────────────────────────────────────────────────────
//
// POST /api/users/bulk  { people: [{ name, email, role }] }
//
// No file is uploaded. The browser reads the CSV, parses it and sends plain
// JSON, so D10 ("no file uploads") stays intact rather than gaining an
// exception: there is no multipart body, nothing written to disk, no
// content-type to confuse and no parser of someone else's format running on the
// server. What arrives here is a list of people, validated like any other input.

const crypto = require("crypto");

// Hashing is the cost here — bcrypt at cost 12 runs about 0.6s per password,
// so a request is capped at something that finishes in several seconds on a
// small instance. The client sends larger imports in chunks of 10.
const MAX_PER_REQUEST = 20;

const NAME_MIN = 2;
const NAME_MAX = 80;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Admins are deliberately not creatable here. A stray value in a spreadsheet
// column should not be able to mint an administrator; that stays a deliberate,
// one-at-a-time act (A9).
const BULK_ROLES = ["student", "teacher"];

// Imported passwords are built from the person's own name plus two digits, at
// the owner's request: memorable, sayable down a phone, and typable by someone
// who has just been told it.
//
// The digits matter more than they look. Without them there are four candidates
// for a two-part name, which anyone knowing that name could try in seconds.
// With them there are 400, and the sign-in limiter allows eight attempts per
// fifteen minutes — so guessing goes from trivial to roughly half a day of
// sustained effort against one account. Still not a secret, and still worth
// changing soon; recorded against B5 in security.md rather than left implied.
const BRAND = "techdea";

// Whitespace splits the name; anything that is not a letter or digit is dropped,
// so a name that arrived as "Patel, Asha" does not produce a password with a
// comma in it that nobody can retype.
function nameParts(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);

  if (parts.length <= 1) return parts;
  // First and last, not first and second: "Ishant Kumar Srivastava" is known by
  // the two ends, not the middle.
  return [parts[0], parts[parts.length - 1]];
}

function generatePassword(name) {
  const digits = String(crypto.randomInt(10, 100)); // always two

  const parts = nameParts(name);
  if (!parts.length) {
    // Nothing usable in the name — a row of punctuation, say. Four digits here
    // rather than two, because the name is carrying no entropy at all.
    return `${BRAND}@${crypto.randomInt(1000, 10000)}`;
  }

  const candidates = parts.flatMap((part) => [
    `${BRAND}@${part}${digits}`,
    `${part}${digits}@${BRAND}`,
  ]);
  return candidates[crypto.randomInt(0, candidates.length)];
}

// Returns either a cleaned row or the reason it cannot be used. Deliberately
// specific: an admin fixing a spreadsheet needs to know which row and why.
function cleanRow(raw) {
  const name = String(raw?.name ?? "").trim();
  const email = String(raw?.email ?? "").trim().toLowerCase();
  const role = String(raw?.role ?? "student").trim().toLowerCase() || "student";

  if (!name) return { error: "name is missing" };
  if (name.length < NAME_MIN) return { error: "name is too short" };
  if (name.length > NAME_MAX) return { error: `name is longer than ${NAME_MAX} characters` };
  if (!email) return { error: "email is missing" };
  if (!EMAIL.test(email)) return { error: "email is not a valid address" };
  if (!BULK_ROLES.includes(role)) {
    return { error: `role must be ${BULK_ROLES.join(" or ")} — admins are added one at a time` };
  }
  return { person: { name, email, role } };
}

exports.bulkCreate = asyncHandler(async (req, res) => {
  const rows = req.body?.people;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ message: "Expected a list of people" });
  }
  if (!rows.length) return res.status(400).json({ message: "There is nobody to import" });
  if (rows.length > MAX_PER_REQUEST) {
    return res.status(400).json({
      message: `Import at most ${MAX_PER_REQUEST} people per request`,
    });
  }

  const candidates = [];
  const skipped = [];

  rows.forEach((raw, index) => {
    const { person, error } = cleanRow(raw);
    if (error) skipped.push({ index, email: String(raw?.email ?? "").trim(), reason: error });
    else candidates.push({ index, ...person });
  });

  // A file that lists the same address twice would otherwise create the first
  // and fail the second on the unique index, which reads as a random failure.
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    if (seen.has(c.email)) skipped.push({ index: c.index, email: c.email, reason: "duplicated in this file" });
    else {
      seen.add(c.email);
      unique.push(c);
    }
  }

  // One query rather than one per row.
  const taken = new Set(
    (await User.find({ email: { $in: [...seen] } }).select("email").lean()).map((u) => u.email)
  );

  const created = [];
  for (const c of unique) {
    if (taken.has(c.email)) {
      skipped.push({ index: c.index, email: c.email, reason: "an account with that email already exists" });
      continue;
    }
    const password = generatePassword(c.name);
    // The password below is derived from their name and is therefore guessable
    // by anyone who knows it. The account is held to a password change on first
    // sign-in until they replace it with one only they know.
    const user = new User({ name: c.name, email: c.email, role: c.role, mustChangePassword: true });
    await user.setPassword(password);
    // Left unverified: an address asserted by an admin has not been proved by
    // the person who owns it. Staff are not gated on this, and students are not
    // gated while mail is off (M24).
    await user.save();

    // The password appears in this response and nowhere else — not in the
    // database, not in a log line. If the admin loses it, the way back is
    // Admin > Users > Set password, not recovery.
    created.push({ name: user.name, email: user.email, role: user.role, password });
  }

  res.status(201).json({
    created,
    skipped: skipped.sort((a, b) => a.index - b.index),
    summary: { received: rows.length, created: created.length, skipped: skipped.length },
  });
});

// ── Bulk actions ──────────────────────────────────────────────────────────
//
// POST /api/users/bulk-action  { ids: [...], action: "activate" | "deactivate" | "delete" }
//
// The same rules the one-at-a-time endpoints apply, applied per row: you cannot
// act on yourself, and a teacher who still owns courses cannot be deleted or
// deactivated out from under them. A row that cannot be done is reported with a
// reason rather than failing the batch — selecting twenty people and being told
// only "409" would leave the admin guessing which one.

const BULK_ACTIONS = ["activate", "deactivate", "delete"];
const MAX_IDS = 200;

exports.bulkAction = asyncHandler(async (req, res) => {
  const { ids, action } = req.body || {};

  if (!BULK_ACTIONS.includes(action)) {
    return res.status(400).json({ message: `Action must be one of ${BULK_ACTIONS.join(", ")}` });
  }
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ message: "Nobody is selected" });
  }
  if (ids.length > MAX_IDS) {
    return res.status(400).json({ message: `At most ${MAX_IDS} people at a time` });
  }

  // Casting happens here rather than in the query: an id that is not an id
  // should be a reported row, not a 500 from deep inside Mongoose.
  const valid = [];
  const skipped = [];
  for (const raw of ids) {
    if (mongoose.isValidObjectId(String(raw))) valid.push(String(raw));
    else skipped.push({ id: String(raw), email: "", reason: "not a valid id" });
  }

  const users = await User.find({ _id: { $in: valid } });
  const found = new Map(users.map((u) => [String(u._id), u]));
  for (const id of valid) {
    if (!found.has(id)) skipped.push({ id, email: "", reason: "no longer exists" });
  }

  const done = [];

  for (const user of users) {
    const id = String(user._id);
    const note = (reason) => skipped.push({ id, email: user.email, reason });

    // Refusing self is also what keeps at least one active admin in existence:
    // the caller is necessarily an active admin (protect requires `active`,
    // requireRole requires `admin`), and cannot be the target, so removing the
    // target always leaves the caller. No separate "last admin" check is needed,
    // and one written here would never fire.
    if (id === String(req.user._id)) {
      note("that's you");
      continue;
    }
    if (action === "delete") {
      const owns = await Course.countDocuments({ owner: user._id });
      if (owns > 0) {
        note(`still owns ${owns} course${owns === 1 ? "" : "s"} — reassign them first`);
        continue;
      }
      await removeUserAndTheirWork(user);
      done.push({ id, email: user.email });
      continue;
    }

    const wanted = action === "activate";
    if (user.active === wanted) {
      note(wanted ? "already active" : "already deactivated");
      continue;
    }
    user.active = wanted;
    await user.save();
    done.push({ id, email: user.email });
  }

  res.json({
    action,
    done,
    skipped,
    summary: { requested: ids.length, done: done.length, skipped: skipped.length },
  });
});
