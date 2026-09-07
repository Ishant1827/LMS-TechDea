const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { signToken } = require("../utils/token");

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

  res.json({ token: signToken(user), user });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/me
exports.updateMe = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  if (email && email.toLowerCase() !== req.user.email) {
    const taken = await User.findOne({ email: email.toLowerCase() });
    if (taken) return res.status(409).json({ message: "That email is already in use" });
    req.user.email = email.toLowerCase();
  }
  if (name) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
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
  await req.user.save();
  res.json({ message: "Password updated" });
});
