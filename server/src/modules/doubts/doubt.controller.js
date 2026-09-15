const Doubt = require("./Doubt.model");
const Course = require("../courses/Course.model");
const Enrollment = require("../enrollments/Enrollment.model");
const Lesson = require("../lessons/Lesson.model");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { DOUBT_STATUS } = require("../../shared/utils/constants");

const populated = (q) =>
  q
    .populate("student", "name email")
    .populate("course", "title")
    .populate("lesson", "title")
    .populate("answeredBy", "name");

const rank = { open: 0, answered: 1, resolved: 2 };
const byOpenThenNew = (a, b) =>
  rank[a.status] - rank[b.status] || new Date(b.createdAt) - new Date(a.createdAt);

// POST /api/doubts  { courseId, lessonId?, text }  — enrolled students
exports.create = asyncHandler(async (req, res) => {
  const { courseId, lessonId, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ message: "Write your question first" });

  const enrolled = await Enrollment.exists({ student: req.user._id, course: courseId });
  if (!enrolled) return res.status(403).json({ message: "Enrol in the course to ask a doubt" });

  let lesson = null;
  if (lessonId) {
    const l = await Lesson.findOne({ _id: lessonId, course: courseId }).select("_id").lean();
    lesson = l ? l._id : null;
  }

  const doubt = await Doubt.create({
    course: courseId,
    lesson,
    student: req.user._id,
    text: text.trim().slice(0, 4000),
  });
  res.status(201).json({ doubt });
});

// GET /api/doubts/mine  (student)
exports.mine = asyncHandler(async (req, res) => {
  const doubts = await populated(Doubt.find({ student: req.user._id }).sort({ createdAt: -1 })).lean();
  res.json({ doubts });
});

// GET /api/doubts/teaching?status=&courseId=   (teacher/admin — doubts on your courses)
exports.teaching = asyncHandler(async (req, res) => {
  const courseFilter = req.user.role === "admin" ? {} : { owner: req.user._id };
  const myCourseIds = await Course.find(courseFilter).distinct("_id");

  const filter = { course: { $in: myCourseIds } };
  if (DOUBT_STATUS.includes(req.query.status)) filter.status = req.query.status;
  // Narrow within the courses you manage — never widen past them.
  if (req.query.courseId) {
    const asked = String(req.query.courseId);
    if (!myCourseIds.some((id) => String(id) === asked)) return res.json({ doubts: [] });
    filter.course = asked;
  }

  const doubts = await populated(Doubt.find(filter)).lean();
  doubts.sort(byOpenThenNew);
  res.json({ doubts });
});

// PATCH /api/doubts/:id   { answer?, status? }   (course owner / admin)
exports.answer = asyncHandler(async (req, res) => {
  const doubt = await Doubt.findById(req.params.id).populate("course", "owner");
  if (!doubt) return res.status(404).json({ message: "Doubt not found" });
  if (req.user.role !== "admin" && String(doubt.course.owner) !== String(req.user._id)) {
    return res.status(403).json({ message: "Not your course" });
  }

  const { answer, status } = req.body;
  if (answer !== undefined) {
    doubt.answer = String(answer).trim().slice(0, 4000);
    doubt.answeredBy = req.user._id;
    doubt.answeredAt = new Date();
    if (doubt.answer && doubt.status === "open") doubt.status = "answered";
  }
  if (DOUBT_STATUS.includes(status)) doubt.status = status;
  await doubt.save();

  const out = await populated(Doubt.findById(doubt._id)).lean();
  res.json({ doubt: out });
});
