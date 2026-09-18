const User = require("./User.model");
const Course = require("../courses/Course.model");
const Enrollment = require("../enrollments/Enrollment.model");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { ROLES } = require("../../shared/utils/constants");

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
  if (!["teacher", "admin"].includes(role)) {
    return res.status(400).json({ message: "Role must be teacher or admin" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }
  if (await User.findOne({ email: email.toLowerCase() })) {
    return res.status(409).json({ message: "Email already in use" });
  }
  const user = new User({ name, email, role });
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
  await Enrollment.deleteMany({ student: user._id });
  await user.deleteOne();
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

  if (String(password || "").length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  await user.setPassword(password);

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

// Hashing is the cost here — bcrypt at cost 10 runs about 150ms per password,
// so a request is capped at something that finishes in a few seconds on a small
// instance. The client sends larger imports in chunks.
const MAX_PER_REQUEST = 50;

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
    const user = new User({ name: c.name, email: c.email, role: c.role });
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
