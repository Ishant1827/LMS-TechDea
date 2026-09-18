const User = require("../users/User.model");
const Course = require("../courses/Course.model");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { signToken } = require("../../shared/utils/token");
const otp = require("./otp.service");
const { notify } = require("../../modules/notifications/notify");
const { mailEnabled } = require("../../shared/mail/config");

// Every flow below depends on a code reaching an inbox. With no mail configured
// that cannot happen, and answering 202 as though it had would leave people
// waiting for a message that does not exist. A 503 with a code the client can
// branch on is the honest answer, and it reveals nothing about any address.
function mailOff(res) {
  return res.status(503).json({
    code: "EMAIL_DISABLED",
    message: "Email isn't set up yet. Ask an admin to set a new password for you.",
  });
}

// Codes that an unauthenticated caller may ask for. Kept as an explicit list
// rather than "any value in OTP_PURPOSES": email_change is only meaningful for a
// signed-in user and is handled on its own endpoint.
const PUBLIC_PURPOSES = ["email_verify", "password_reset"];

const normaliseEmail = (value) => String(value || "").toLowerCase().trim();

// Mint a code and put it on its way. Never throws: a code we could not send is
// recoverable — the user asks for another — whereas a registration that fails
// because of the email is not. The 429 from the issuer is swallowed here for the
// same reason, and because surfacing it on a public endpoint would confirm that
// somebody recently asked about this address.
async function sendCode({ email, purpose, userId = null }) {
  try {
    const { code, expiresMinutes } = await otp.issue({ email, purpose, userId });
    // Not awaited: SMTP latency is unbounded and no request should wait on it.
    void notify("auth.otp.requested", { email, code, purpose, expiresMinutes });
    return true;
  } catch (err) {
    if (err.status !== 429) console.error(`[otp] could not issue ${purpose} — ${err.message}`);
    return false;
  }
}

// POST /api/auth/register  — always creates a student
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }
  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) return res.status(409).json({ message: "An account with that email already exists" });

  const user = new User({ name, email, phone: phone || "", role: "student" });
  await user.setPassword(password);
  await user.save();

  // The account exists and can sign in straight away; it just cannot enrol or
  // submit until the address is confirmed. See requireVerified — which also
  // stands down when there is no mail, so with email off this is simply skipped
  // and nothing is gated.
  if (mailEnabled()) {
    await sendCode({ email: user.email, purpose: "email_verify", userId: user._id });
  }

  res.status(201).json({ token: signToken(user), user });
});

// POST /api/auth/otp/request — ask for a one-time code
//
// Answers 202 identically whether or not the address belongs to an account, and
// whether or not a code was actually sent. That is the same rule sign-in follows
// (A10): the difference between "sent" and "not sent" is exactly the fact an
// enumerator is shopping for, and the only place it is allowed to show up is the
// inbox of whoever owns the address.
exports.otpRequest = asyncHandler(async (req, res) => {
  if (!mailEnabled()) return mailOff(res);

  const email = normaliseEmail(req.body.email);
  const purpose = String(req.body.purpose || "");

  if (!PUBLIC_PURPOSES.includes(purpose)) {
    return res.status(400).json({ message: "Unsupported code type" });
  }
  // Not an enumeration risk: this is about the shape of the input, not about
  // whether the address exists.
  if (!email) return res.status(400).json({ message: "Email is required" });

  const user = await User.findOne({ email });

  if (purpose === "email_verify") {
    // Silent on every branch — no such user, already verified, deactivated.
    if (user && user.active && !user.emailVerifiedAt) {
      await sendCode({ email, purpose, userId: user._id });
    }
  }

  if (purpose === "password_reset") {
    // Deliberately does NOT require a verified address. Someone who never got
    // their signup code and has since forgotten their password would otherwise
    // have no way back in at all, which is the lockout this feature exists to
    // remove. Receiving the reset code proves the address either way.
    if (user && user.active) {
      await sendCode({ email, purpose, userId: user._id });
    }
  }

  res.status(202).json({ message: "If that address needs a code, we've sent one." });
});

// POST /api/auth/otp/verify — spend a one-time code
//
// Unauthenticated by design: someone who closed the tab, or opened the email on
// their phone, still has to be able to finish. Holding the code is the proof.
exports.otpVerify = asyncHandler(async (req, res) => {
  if (!mailEnabled()) return mailOff(res);

  const email = normaliseEmail(req.body.email);
  const purpose = String(req.body.purpose || "");
  const { code } = req.body;

  if (!PUBLIC_PURPOSES.includes(purpose)) {
    return res.status(400).json({ message: "Unsupported code type" });
  }

  const result = await otp.verify({ email, purpose, code });

  // One message for every failure. The service distinguishes expired from wrong
  // from never-existed; the client is told none of it, because that difference
  // maps which addresses have a code outstanding.
  if (!result.ok) {
    return res.status(400).json({ message: "That code is wrong or has expired. Ask for a new one." });
  }

  const user = result.userId
    ? await User.findById(result.userId)
    : await User.findOne({ email });

  if (!user || !user.active) {
    return res.status(400).json({ message: "That code is wrong or has expired. Ask for a new one." });
  }

  if (purpose === "password_reset") {
    // The code is spent, but nothing has changed yet. Hand back a short-lived
    // single-use token; POST /password/reset is what actually rotates the
    // password, and it will want this (M12).
    const { actionToken, expiresMinutes } = await otp.issueActionToken({ email, purpose });
    return res.json({ verified: true, actionToken, expiresMinutes });
  }

  if (!user.emailVerifiedAt) {
    user.emailVerifiedAt = new Date();
    await user.save();
  }

  // Deliberately thin. The caller here is not necessarily signed in, so this
  // returns confirmation rather than an account record; the client refreshes
  // through /api/auth/me, which is already authenticated.
  res.json({ verified: true });
});

// POST /api/auth/password/reset — finish a forgotten-password flow
//
// Unauthenticated, and authorised entirely by the action token minted above.
exports.resetPassword = asyncHandler(async (req, res) => {
  if (!mailEnabled()) return mailOff(res);

  const email = normaliseEmail(req.body.email);
  const { actionToken, newPassword } = req.body;

  if (String(newPassword || "").length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters" });
  }

  const spent = await otp.consumeActionToken({ email, purpose: "password_reset", actionToken });
  if (!spent.ok) {
    return res.status(400).json({ message: "That reset has expired. Start again from the sign-in page." });
  }

  const user = spent.userId ? await User.findById(spent.userId) : await User.findOne({ email });
  if (!user || !user.active) {
    return res.status(400).json({ message: "That reset has expired. Start again from the sign-in page." });
  }

  await user.setPassword(newPassword);

  // Every existing session ends here. This is the whole point: the most likely
  // reason someone is resetting a password is that somebody else has it, and a
  // reset that leaves the intruder's token working would be theatre.
  user.tokenVersion = (user.tokenVersion || 0) + 1;

  // Receiving the code proved control of the address, so a previously
  // unverified account is verified by having completed this.
  if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();

  await user.save();

  void notify("auth.password.changed", {
    email: user.email,
    name: user.name,
    changedAt: new Date(),
  });

  // No token is returned. Signing in with the new password is the confirmation
  // that it is the one they meant, and it costs one screen.
  res.json({ message: "Password updated. Sign in with your new password." });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || "").toLowerCase() });
  if (!user || !(await user.checkPassword(password || ""))) {
    return res.status(401).json({ message: "Wrong email or password" });
  }
  if (!user.active) return res.status(403).json({ message: "This account is deactivated" });

  res.json({ token: signToken(user), user });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/me
exports.updateMe = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  const nameChanged = name && name.trim() && name.trim() !== req.user.name;

  // The address is no longer editable here. It used to be written straight in,
  // unverified — which, once email became the recovery channel, meant a stolen
  // token could redirect every future code to the attacker and lock the owner
  // out for good. It now has its own flow: password, then a code to the new
  // address, then a notice to the old one.
  if (email && email.toLowerCase() !== req.user.email) {
    return res.status(400).json({
      code: "USE_EMAIL_CHANGE_FLOW",
      message: "Use the email change flow to update your address.",
    });
  }
  if (name && name.trim()) req.user.name = name.trim();
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();

  // the teacher name shown on a course follows the owner's account name
  if (nameChanged) {
    await Course.updateMany({ owner: req.user._id }, { $set: { teacherName: req.user.name } });
  }

  res.json({ user: req.user });
});

// PUT /api/auth/me/password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!(await req.user.checkPassword(currentPassword || ""))) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }
  if (String(newPassword || "").length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters" });
  }
  await req.user.setPassword(newPassword);

  // Same reasoning as the reset path: other sessions end. The difference is
  // that this caller is in front of us and has just proved they know the old
  // password, so they are handed a token on the new version rather than being
  // signed out of the tab they are typing in.
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();

  void notify("auth.password.changed", {
    email: req.user.email,
    name: req.user.name,
    changedAt: new Date(),
  });

  res.json({ message: "Password updated", token: signToken(req.user) });
});

// PUT /api/auth/me/email — start an address change
//
// The current password is required, and that is the control that matters here.
// A token on its own is not enough: G3 keeps tokens in localStorage, so any XSS
// yields one, and without this an attacker holding a token could repoint the
// account's recovery channel at themselves. A password they do not have stops
// the whole chain.
exports.requestEmailChange = asyncHandler(async (req, res) => {
  if (!mailEnabled()) return mailOff(res);

  const newEmail = normaliseEmail(req.body.newEmail);
  const { currentPassword } = req.body;

  if (!(await req.user.checkPassword(currentPassword || ""))) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }
  if (newEmail === req.user.email) {
    return res.status(400).json({ message: "That is already your email address" });
  }

  // The caller has proved who they are, so telling them an address is taken is
  // not enumeration — it is the answer to a question about their own account,
  // and the alternative is a flow that silently never completes.
  const taken = await User.findOne({ email: newEmail });
  if (taken) return res.status(409).json({ message: "That email is already in use" });

  req.user.pendingEmail = newEmail;
  await req.user.save();

  // Keyed on the NEW address: it is the one being proved.
  const sent = await sendCode({ email: newEmail, purpose: "email_change", userId: req.user._id });
  if (!sent) {
    return res.status(429).json({ message: "Please wait a moment before requesting another code." });
  }

  res.status(202).json({ pendingEmail: newEmail, message: `We've sent a code to ${newEmail}.` });
});

// POST /api/auth/me/email/verify — finish an address change
//
// Authenticated, unlike the public otp/verify: the account is known, and the
// only thing left to prove is control of the address the code went to.
exports.verifyEmailChange = asyncHandler(async (req, res) => {
  if (!mailEnabled()) return mailOff(res);

  const pending = normaliseEmail(req.user.pendingEmail);
  if (!pending) {
    return res.status(400).json({ message: "There is no email change waiting." });
  }

  const result = await otp.verify({ email: pending, purpose: "email_change", code: req.body.code });
  if (!result.ok) {
    return res.status(400).json({ message: "That code is wrong or has expired. Ask for a new one." });
  }
  // The code was minted for this account; a code obtained any other way is not
  // spendable on it.
  if (result.userId && String(result.userId) !== String(req.user._id)) {
    return res.status(400).json({ message: "That code is wrong or has expired. Ask for a new one." });
  }

  // Re-checked at the last moment: the address could have been claimed by
  // somebody else between starting this and finishing it.
  const taken = await User.findOne({ email: pending });
  if (taken) {
    req.user.pendingEmail = "";
    await req.user.save();
    return res.status(409).json({ message: "That email was taken while you were confirming. Try another." });
  }

  const previousEmail = req.user.email;
  req.user.email = pending;
  req.user.pendingEmail = "";
  // Proved by the code that just arrived there.
  req.user.emailVerifiedAt = new Date();
  await req.user.save();

  // To the address being left behind, unconditionally. The owner of a hijacked
  // account has no other channel left by this point.
  void notify("auth.email.changed", {
    previousEmail,
    newEmail: req.user.email,
    name: req.user.name,
    changedAt: new Date(),
  });

  res.json({ user: req.user });
});

// DELETE /api/auth/me/email — abandon a pending change
exports.cancelEmailChange = asyncHandler(async (req, res) => {
  const pending = normaliseEmail(req.user.pendingEmail);
  if (pending) {
    req.user.pendingEmail = "";
    await req.user.save();
    // The outstanding code stops working immediately rather than lingering for
    // its remaining ten minutes.
    await otp.invalidate({ email: pending, purpose: "email_change" });
  }
  res.json({ user: req.user });
});
