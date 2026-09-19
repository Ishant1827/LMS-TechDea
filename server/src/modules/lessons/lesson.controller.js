const Course = require("../courses/Course.model");
const Lesson = require("./Lesson.model");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { LESSON_TYPES } = require("../../shared/utils/constants");
const { isSafeUrl, LINK_ERROR } = require("../../shared/utils/url");

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

// Returns { data } on success, or { error } when a pasted link isn't usable.
function cleanLessonInput(body) {
  const out = {};
  for (const f of LESSON_FIELDS) if (body[f] !== undefined) out[f] = body[f];
  if (out.type && !LESSON_TYPES.includes(out.type)) out.type = "reading";
  if (out.durationMin !== undefined) out.durationMin = Math.max(0, Number(out.durationMin) || 0);
  if (out.module !== undefined) out.module = String(out.module).trim() || "Introduction";

  // These are rendered as an <iframe src> / <a href> for every student on the
  // course, so a non-http(s) scheme would be script running in our origin.
  for (const f of ["videoUrl", "fileUrl"]) {
    if (out[f] === undefined) continue;
    out[f] = String(out[f]).trim();
    if (!isSafeUrl(out[f])) return { error: LINK_ERROR };
  }
  return { data: out };
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

  const { data, error } = cleanLessonInput(req.body);
  if (error) return res.status(400).json({ message: error });
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

  // A body with the wrong key used to be answered with a cheerful 200 and an
  // unchanged list — a success the caller did not earn, and the kind of reply
  // that hides a typo in a client for months.
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    return res
      .status(400)
      .json({ message: "orderedIds must be a non-empty array of lesson ids" });
  }

  // And a list that does not name every lesson is not a reorder: the ones left
  // out keep their old `order` and the curriculum comes back interleaved. The
  // set has to match exactly, which also means nothing unrecognisable ever
  // reaches updateOne and becomes a cast error half way through the writes.
  const existing = await Lesson.find({ course: course._id }).select("_id").lean();
  const known = new Set(existing.map((l) => String(l._id)));
  const given = orderedIds.map(String);
  const unique = new Set(given);

  if (unique.size !== given.length) {
    return res.status(400).json({ message: "orderedIds lists the same lesson twice" });
  }
  if (unique.size !== known.size || given.some((id) => !known.has(id))) {
    return res
      .status(400)
      .json({ message: "orderedIds must list every lesson in this course, exactly once" });
  }

  await Promise.all(
    given.map((id, i) => Lesson.updateOne({ _id: id, course: course._id }, { $set: { order: i } }))
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

  const { data, error } = cleanLessonInput(req.body);
  if (error) return res.status(400).json({ message: error });
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
