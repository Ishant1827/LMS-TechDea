const Submission = require("../models/Submission");
const Assessment = require("../models/Assessment");
const Course = require("../models/Course");
const asyncHandler = require("../utils/asyncHandler");

const canManage = (user, course) =>
  user.role === "admin" || String(course.owner) === String(user._id);

function percentOf(sub, a) {
  if (sub.score == null) return null;
  if (a.kind === "quiz") return Math.round(sub.score);
  const max = a.points || 100;
  return max ? Math.round((sub.score / max) * 100) : 0;
}

// PATCH /api/submissions/:id/grade   { score, feedback }   (course owner / admin)
exports.grade = asyncHandler(async (req, res) => {
  const sub = await Submission.findById(req.params.id).populate("student", "name email");
  if (!sub) return res.status(404).json({ message: "Submission not found" });

  const [assessment, course] = await Promise.all([
    Assessment.findById(sub.assessment),
    Course.findById(sub.course).select("owner"),
  ]);
  if (!assessment || !course) return res.status(404).json({ message: "Assessment not found" });
  if (!canManage(req.user, course)) return res.status(403).json({ message: "Not your course" });

  const max = assessment.kind === "quiz" ? 100 : assessment.points || 100;
  if (req.body.score !== undefined && req.body.score !== null && req.body.score !== "") {
    const n = Number(req.body.score);
    if (Number.isNaN(n) || n < 0 || n > max) {
      return res.status(400).json({ message: `Score must be between 0 and ${max}` });
    }
    sub.score = Math.round(n * 100) / 100;
    sub.status = "graded";
    sub.gradedBy = req.user._id;
    sub.gradedAt = new Date();
  }
  if (req.body.feedback !== undefined) {
    sub.feedback = String(req.body.feedback).slice(0, 8000);
    if (sub.status !== "graded") {
      sub.status = "graded";
      sub.gradedBy = req.user._id;
      sub.gradedAt = new Date();
    }
  }
  await sub.save();

  const percent = percentOf(sub, assessment);
  res.json({
    submission: {
      _id: sub._id,
      status: sub.status,
      text: sub.text || "",
      link: sub.link || "",
      answers: sub.answers || [],
      autoScore: sub.autoScore,
      score: sub.score,
      percent,
      passed: percent == null ? null : percent >= (assessment.passPercent || 0),
      feedback: sub.feedback || "",
      submittedAt: sub.submittedAt,
      gradedAt: sub.gradedAt,
      student: sub.student,
    },
  });
});
