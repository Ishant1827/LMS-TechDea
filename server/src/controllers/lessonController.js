const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const asyncHandler = require("../utils/asyncHandler");
const { LESSON_TYPES } = require("../utils/constants");

const LESSON_FIELDS = [
  "title",
  "module",
  "type",
  "durationMin",
  "published",
  "videoUrl",
  "content",
  "fileUrl",
  "fileName",
];

// Load the course from :courseId and confirm req.user may manage it.
// Sends the error response and returns null when not allowed.
async function loadManageableCourse(req, res) {
  const course = await Course.findById(req.params.courseId);
  if (!course) {
    res.status(404).json({ message: "Course not found" });
    return null;
  }
  if (req.user.role !== "admin" && String(course.owner) !== String(req.user._id)) {
    res.status(403).json({ message: "Not your course" });
    return null;
  }
  return course;
}

function cleanLessonInput(body) {
  const out = {};
  for (const f of LESSON_FIELDS) if (body[f] !== undefined) out[f] = body[f];
  if (out.type && !LESSON_TYPES.includes(out.type)) out.type = "reading";
  if (out.durationMin !== undefined) out.durationMin = Math.max(0, Number(out.durationMin) || 0);
  if (out.module !== undefined) out.module = String(out.module).trim() || "Introduction";
  return out;
}

// GET /api/courses/:courseId/lessons  (optionalAuth)
exports.list = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId).lean();
  if (!course) return res.status(404).json({ message: "Course not found" });
  const isManager =
    req.user && (req.user.role === "admin" || String(course.owner) === String(req.user._id));
  if (!course.published && !isManager) return res.status(404).json({ message: "Course not found" });

  const filter = { course: course._id };
  if (!isManager) filter.published = { $ne: false };
  const lessons = await Lesson.find(filter).sort({ order: 1, createdAt: 1 }).lean();
  res.json({ lessons });
});

// POST /api/courses/:courseId/lessons
exports.create = asyncHandler(async (req, res) => {
  const course = await loadManageableCourse(req, res);
  if (!course) return;

  const data = cleanLessonInput(req.body);
  if (!data.title || !String(data.title).trim()) {
    return res.status(400).json({ message: "Lesson title is required" });
  }

  const last = await Lesson.findOne({ course: course._id }).sort({ order: -1 });
  const lesson = await Lesson.create({
    ...data,
    course: course._id,
    module: data.module || "Introduction",
    order: last ? last.order + 1 : 0,
  });
  res.status(201).json({ lesson });
});

// PUT /api/courses/:courseId/lessons/reorder  { orderedIds: [...] }
exports.reorder = asyncHandler(async (req, res) => {
  const course = await loadManageableCourse(req, res);
  if (!course) return;

  const ids = Array.isArray(req.body.orderedIds) ? req.body.orderedIds : [];
  await Promise.all(
    ids.map((id, i) => Lesson.updateOne({ _id: id, course: course._id }, { $set: { order: i } }))
  );
  const lessons = await Lesson.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).lean();
  res.json({ lessons });
});

// PUT /api/courses/:courseId/lessons/:lessonId
exports.update = asyncHandler(async (req, res) => {
  const course = await loadManageableCourse(req, res);
  if (!course) return;

  const lesson = await Lesson.findOne({ _id: req.params.lessonId, course: course._id });
  if (!lesson) return res.status(404).json({ message: "Lesson not found" });

  const data = cleanLessonInput(req.body);
  Object.assign(lesson, data);
  await lesson.save();
  res.json({ lesson });
});

// DELETE /api/courses/:courseId/lessons/:lessonId
exports.remove = asyncHandler(async (req, res) => {
  const course = await loadManageableCourse(req, res);
  if (!course) return;

  const lesson = await Lesson.findOneAndDelete({ _id: req.params.lessonId, course: course._id });
  if (!lesson) return res.status(404).json({ message: "Lesson not found" });
  res.json({ message: "Lesson deleted" });
});
