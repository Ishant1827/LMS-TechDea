const Course = require("../courses/Course.model");
const Lesson = require("../lessons/Lesson.model");
const Enrollment = require("./Enrollment.model");
const asyncHandler = require("../../shared/utils/asyncHandler");

function firstIncompleteId(lessons, doneSet) {
  const next = lessons.find((l) => !doneSet.has(String(l._id)));
  if (next) return next._id;
  return lessons.length ? lessons[lessons.length - 1]._id : null;
}

// Which lesson "Continue" should open.
// - not finished + a remembered lesson that still exists -> that lesson (resume)
// - otherwise -> first not-yet-completed (or last, if all done)
function resumeLessonId(lessons, doneSet, lastLessonId) {
  const allDone = lessons.length > 0 && doneSet.size >= lessons.length;
  if (!allDone && lastLessonId) {
    const hit = lessons.find((l) => String(l._id) === String(lastLessonId));
    if (hit) return hit._id;
  }
  return firstIncompleteId(lessons, doneSet);
}

function progressFor(lessons, completedIds, lastLessonId) {
  const done = new Set((completedIds || []).map(String));
  const total = lessons.length;
  const completed = lessons.filter((l) => done.has(String(l._id))).length;
  return {
    total,
    completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
    currentLessonId: resumeLessonId(lessons, done, lastLessonId),
    completedLessonIds: lessons.filter((l) => done.has(String(l._id))).map((l) => l._id),
  };
}

// student-visible lessons only (drafts don't count toward progress)
const courseLessons = (courseId) =>
  Lesson.find({ course: courseId, published: { $ne: false } })
    .sort({ order: 1, createdAt: 1 })
    .lean();

// Recompute status/completedAt on an enrollment doc from its completed count.
function syncCompletion(enrollment, total) {
  const isComplete = total > 0 && enrollment.completedLessons.length >= total;
  if (isComplete && enrollment.status !== "completed") {
    enrollment.status = "completed";
    enrollment.completedAt = new Date();
    return true; // just completed
  }
  if (!isComplete && enrollment.status === "completed") {
    enrollment.status = "active";
    enrollment.completedAt = null;
  }
  return false;
}

// POST /api/enrollments  { courseId }
exports.enroll = asyncHandler(async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Only students can enrol in courses" });
  }
  const course = await Course.findById(req.body.courseId);
  if (!course || !course.published) return res.status(404).json({ message: "Course not found" });

  const existing = await Enrollment.findOne({ student: req.user._id, course: course._id });
  if (existing) return res.status(200).json({ enrollment: existing, message: "Already enrolled" });

  const enrollment = await Enrollment.create({
    student: req.user._id,
    course: course._id,
    completedLessons: [],
  });
  res.status(201).json({ enrollment });
});

// GET /api/enrollments/mine
exports.mine = asyncHandler(async (req, res) => {
  const enrolls = await Enrollment.find({ student: req.user._id }).populate("course").lean();
  const active = enrolls.filter((e) => e.course); // drop enrollments whose course was deleted

  const lessons = await Lesson.find({
    course: { $in: active.map((e) => e.course._id) },
    published: { $ne: false },
  })
    .sort({ order: 1, createdAt: 1 })
    .lean();
  const byCourse = {};
  for (const l of lessons) (byCourse[String(l.course)] ||= []).push(l);

  res.json({
    enrollments: active.map((e) => {
      const cl = byCourse[String(e.course._id)] || [];
      const p = progressFor(cl, e.completedLessons, e.lastLessonId);
      const cur = cl.find((l) => String(l._id) === String(p.currentLessonId));
      return {
        _id: e._id,
        course: e.course,
        status: e.status,
        completedAt: e.completedAt,
        updatedAt: e.updatedAt,
        ...p,
        remaining: Math.max(0, p.total - p.completed),
        currentLesson: cur
          ? { _id: cur._id, title: cur.title, type: cur.type, durationMin: cur.durationMin, module: cur.module }
          : null,
      };
    }),
  });
});

// DELETE /api/enrollments/:courseId
exports.unenroll = asyncHandler(async (req, res) => {
  await Enrollment.findOneAndDelete({ student: req.user._id, course: req.params.courseId });
  res.json({ message: "Un-enrolled" });
});

// GET /api/enrollments/:courseId/notes  -> { notes: { <lessonId>: "text" } }
exports.getNotes = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findOne({
    student: req.user._id,
    course: req.params.courseId,
  }).lean();
  if (!enrollment) return res.status(404).json({ message: "You are not enrolled in this course" });
  res.json({ notes: enrollment.notes || {} });
});

// PUT /api/enrollments/:courseId/notes/:lessonId  { text }
exports.saveNote = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findOne({
    student: req.user._id,
    course: req.params.courseId,
  });
  if (!enrollment) return res.status(404).json({ message: "You are not enrolled in this course" });

  const text = String(req.body.text || "").slice(0, 8000);
  if (text.trim()) enrollment.notes.set(req.params.lessonId, text);
  else enrollment.notes.delete(req.params.lessonId);
  await enrollment.save();
  res.json({ ok: true });
});

// POST /api/enrollments/:courseId/visit  { lessonId }  — remember position, no completion
exports.visit = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findOne({
    student: req.user._id,
    course: req.params.courseId,
  });
  if (!enrollment) return res.status(404).json({ message: "You are not enrolled in this course" });

  const lesson = await Lesson.findOne({ _id: req.body.lessonId, course: req.params.courseId });
  if (lesson) {
    enrollment.lastLessonId = lesson._id;
    await enrollment.save();
  }
  res.json({ ok: true });
});

// POST /api/enrollments/:courseId/complete  { lessonId }
exports.completeLesson = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findOne({
    student: req.user._id,
    course: req.params.courseId,
  });
  if (!enrollment) return res.status(404).json({ message: "You are not enrolled in this course" });

  const lesson = await Lesson.findOne({ _id: req.body.lessonId, course: req.params.courseId });
  if (!lesson) return res.status(404).json({ message: "Lesson not found" });

  if (!enrollment.completedLessons.some((id) => String(id) === String(lesson._id))) {
    enrollment.completedLessons.push(lesson._id);
  }
  enrollment.lastLessonId = lesson._id;

  const all = await courseLessons(req.params.courseId);
  const justCompleted = syncCompletion(enrollment, all.length);
  await enrollment.save();

  res.json({
    ...progressFor(all, enrollment.completedLessons, null),
    status: enrollment.status,
    completedAt: enrollment.completedAt,
    justCompletedCourse: justCompleted,
  });
});

// GET /api/enrollments/all  (admin)
exports.all = asyncHandler(async (req, res) => {
  const enrolls = await Enrollment.find()
    .populate("student", "name email")
    .populate("course", "title")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  res.json({ enrollments: enrolls.filter((e) => e.student && e.course) });
});
