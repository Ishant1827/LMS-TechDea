const Review = require("./Review.model");
const Enrollment = require("../enrollments/Enrollment.model");
const Course = require("../courses/Course.model");
const asyncHandler = require("../../shared/utils/asyncHandler");

// GET /api/courses/:id/reviews
exports.list = asyncHandler(async (req, res) => {
  const courseId = req.params.id;
  const reviews = await Review.find({ course: courseId })
    .populate("student", "name")
    .sort({ createdAt: -1 })
    .lean();

  const count = reviews.length;
  const avg = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
  const mine = req.user ? reviews.find((r) => String(r.student?._id) === String(req.user._id)) : null;

  res.json({ reviews, avg, count, mine: mine || null });
});

// POST /api/courses/:id/reviews  { rating, text }  — enrolled students only
exports.upsert = asyncHandler(async (req, res) => {
  const courseId = req.params.id;
  const rating = Number(req.body.rating);
  if (!(rating >= 1 && rating <= 5)) {
    return res.status(400).json({ message: "Rating must be 1 to 5" });
  }
  const course = await Course.findById(courseId).lean();
  if (!course) return res.status(404).json({ message: "Course not found" });

  const enrolled = await Enrollment.exists({ student: req.user._id, course: courseId });
  if (!enrolled) return res.status(403).json({ message: "Enrol in the course to review it" });

  const review = await Review.findOneAndUpdate(
    { course: courseId, student: req.user._id },
    { $set: { rating, text: String(req.body.text || "").trim().slice(0, 2000) } },
    { new: true, upsert: true }
  );
  res.json({ review });
});

// DELETE /api/courses/:id/reviews/mine
exports.removeMine = asyncHandler(async (req, res) => {
  await Review.findOneAndDelete({ course: req.params.id, student: req.user._id });
  res.json({ message: "Review removed" });
});
