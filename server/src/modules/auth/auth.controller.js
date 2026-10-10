const User = require("../users/User.model");
const Course = require("../courses/Course.model");
const RevokedToken = require("./RevokedToken.model");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { signToken } = require("../../shared/utils/token");
const { passwordProblem } = require("../../shared/utils/password");

// POST /api/auth/register  — always creates a student
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }
  const weak = passwordProblem(password, { name, email });
  if (weak) return res.status(400).json({ message: weak });
  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) return res.status(409).json({ message: "An account with that email already exists" });

  const user = new User({ name, email, phone: phone || "", role: "student" });
  await user.setPassword(password);
  await user.save();

  res.status(201).json({ token: signToken(user), user });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || "").toLowerCase() });
  if (!user || !(await user.checkPassword(password || ""))) {
    return res.status(401).json({ message: "Wrong email or password" });
  }
  if (!user.active) return res.status(403).json({ message: "This account is deactivated" });
  if (await user.upgradeHashIfNeeded(password)) await user.save();

  res.json({ token: signToken(user), user });
});

// POST /api/auth/logout — ends this token only; the account's other sessions
// carry on. ("Sign out everywhere" is what a password change already does.)
exports.logout = asyncHandler(async (req, res) => {
  const { jti, exp } = req.token;
  if (jti) {
    // Upsert, so signing out twice with the same token is not an error.
    await RevokedToken.updateOne(
      { jti },
      { $setOnInsert: { jti, expiresAt: new Date(exp * 1000) } },
      { upsert: true }
    );
  }
  res.json({ message: "Signed out" });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/me
exports.updateMe = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  const nameChanged = name && name.trim() && name.trim() !== req.user.name;

  // Editable here again. It was locked down while email was the account recovery
  // channel — a stolen token could have repointed every future code at an
  // attacker. With no email anywhere, recovery is an admin setting a password,
  // so the address is an ordinary profile field once more.
  if (email && email.toLowerCase() !== req.user.email) {
    const taken = await User.findOne({ email: email.toLowerCase() });
    if (taken) return res.status(409).json({ message: "That email is already in use" });
    req.user.email = email.toLowerCase();
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
  const weak = passwordProblem(newPassword, req.user);
  if (weak) return res.status(400).json({ message: weak });
  await req.user.setPassword(newPassword);

  // Same reasoning as the reset path: other sessions end. The difference is
  // that this caller is in front of us and has just proved they know the old
  // password, so they are handed a token on the new version rather than being
  // signed out of the tab they are typing in.
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  // Whatever brought them here — an import, an admin reset — the password is now
  // one only they know, so the hold is lifted.
  req.user.mustChangePassword = false;
  await req.user.save();

  res.json({ message: "Password updated", token: signToken(req.user) });
});
