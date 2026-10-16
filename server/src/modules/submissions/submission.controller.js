const Submission = require("./Submission.model");
const Assessment = require("../assessments/Assessment.model");
const Course = require("../courses/Course.model");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { canManage } = require("../../shared/utils/access");
const { shapeSubmission } = require("./submission.shape");

// GET /api/submissions/pending   (teacher/admin)
//
// What is waiting to be graded, across every course this person manages, grouped
// by course so the dashboard can say which one and link to it. Quizzes grade
// themselves on submit, so in practice this is the assignment pile.
exports.pending = asyncHandler(async (req, res) => {
  const courseFilter = req.user.role === "admin" ? {} : { owner: req.user._id };
  const courses = await Course.find(courseFilter).select("title").lean();
  if (!courses.length) return res.json({ total: 0, courses: [] });

  const counts = await Submission.aggregate([
    // "submitted" only: work the teacher already sent back is the student's
    // move, not theirs, so it must not sit in their queue.
    { $match: { course: { $in: courses.map((c) => c._id) }, status: "submitted" } },
    { $group: { _id: "$course", pending: { $sum: 1 } } },
  ]);
  const byCourse = new Map(counts.map((c) => [String(c._id), c.pending]));

  const rows = courses
    .map((c) => ({ _id: c._id, title: c.title, pending: byCourse.get(String(c._id)) || 0 }))
    .filter((c) => c.pending > 0)
    .sort((a, b) => b.pending - a.pending);

  res.json({ total: rows.reduce((s, c) => s + c.pending, 0), courses: rows });
});

// PATCH /api/submissions/:id/return   { feedback }   (course owner / admin)
//
// Send an assignment back for another try. Reopening is the teacher's call and
// only the teacher's: a student cannot edit or withdraw what they submitted, so
// every reopen is a deliberate act with a reason attached to it.
//
// Quizzes cannot be returned. The answer key is revealed once a student has
// attempted one, so a second try would be taken with the answers in hand — that
// is not a retake, it is a free mark.
exports.returnForRevision = asyncHandler(async (req, res) => {
  const sub = await Submission.findById(req.params.id).populate("student", "name email");
  if (!sub) return res.status(404).json({ message: "Submission not found" });

  const [assessment, course] = await Promise.all([
    Assessment.findById(sub.assessment),
    Course.findById(sub.course).select("owner"),
  ]);
  if (!assessment || !course) return res.status(404).json({ message: "Assessment not found" });
  if (!canManage(req.user, course)) return res.status(403).json({ message: "Not your course" });

  if (assessment.kind === "quiz") {
    return res.status(400).json({
      message: "A quiz can't be sent back — the answer key is shown after the attempt",
    });
  }
  if (sub.status === "returned") {
    return res.status(409).json({ message: "This is already with the student" });
  }

  // The note is the point of the button: without it the student is told to redo
  // the work and not told why.
  const feedback = String(req.body.feedback || "").trim();
  if (!feedback) {
    return res.status(400).json({ message: "Say what needs changing before sending it back" });
  }

  sub.feedback = feedback.slice(0, 8000);
  sub.status = "returned";
  sub.returnedAt = new Date();
  // A mark can't stand on work that is about to change.
  sub.score = null;
  sub.gradedBy = null;
  sub.gradedAt = null;
  await sub.save();

  res.json({ submission: shapeSubmission(sub, assessment) });
});

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
  // Feedback on its own is a note, not a grade. It used to mark the work
  // "graded" too, so saving with the score box empty took the submission out
  // of the pending queue and told the student it was graded — with no mark.
  if (req.body.feedback !== undefined) {
    sub.feedback = String(req.body.feedback).slice(0, 8000);
  }
  await sub.save();

  res.json({ submission: shapeSubmission(sub, assessment) });
});
