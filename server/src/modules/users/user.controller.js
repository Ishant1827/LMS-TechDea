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
