const mongoose = require("mongoose");
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

// Recompute status/completedAt on an enrollment doc from the lessons a student
// can see now. Counting `completedLessons` alone was wrong: it still holds ids
// of lessons since hidden or deleted, so a student could be "complete" with
// visible lessons left to do.
function syncCompletion(enrollment, lessons) {
  const done = new Set(enrollment.completedLessons.map(String));
  const isComplete = lessons.length > 0 && lessons.every((l) => done.has(String(l._id)));
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
  // Enrolments first (they name the courses), then the courses and their
  // lessons side by side — two round trips, where populate-then-find was three.
  const enrolls = await Enrollment.find({ student: req.user._id }).lean();
  const courseIds = enrolls.map((e) => e.course);
  const [courses, lessons] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).lean(),
    Lesson.find({ course: { $in: courseIds }, published: { $ne: false } })
      .sort({ order: 1, createdAt: 1 })
      .lean(),
  ]);
  const courseById = new Map(courses.map((c) => [String(c._id), c]));
  // drop enrolments whose course was deleted
  const active = enrolls
    .map((e) => ({ ...e, course: courseById.get(String(e.course)) }))
    .filter((e) => e.course);
  const byCourse = {};
  for (const l of lessons) (byCourse[String(l.course)] ||= []).push(l);

  res.json({
    enrollments: active.map((e) => {
      const cl = byCourse[String(e.course._id)] || [];
      const p = progressFor(cl, e.completedLessons, e.lastLessonId);
      const cur = cl.find((l) => String(l._id) === String(p.currentLessonId));
      // From live progress, not the stored field: that is only rewritten when
      // a lesson is ticked, so a lesson added later left it saying "completed".
      const complete = p.total > 0 && p.completed >= p.total;
      return {
        _id: e._id,
        course: e.course,
        status: complete ? "completed" : "active",
        completedAt: complete ? e.completedAt : null,
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

  // Only for a lesson that is in this course. Any other key used to be stored
  // as given, so the notes map could fill with junk (or a key Mongo rejects).
  const lessonOk =
    mongoose.isValidObjectId(req.params.lessonId) &&
    (await Lesson.exists({ _id: req.params.lessonId, course: enrollment.course }));
  if (!lessonOk) return res.status(404).json({ message: "Lesson not found" });

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

  // Drafts are hidden from students, so they can't be completed either — a
  // draft id in the list would count once the lesson is published.
  const lesson = await Lesson.findOne({
    _id: req.body.lessonId,
    course: req.params.courseId,
    published: { $ne: false },
  });
  if (!lesson) return res.status(404).json({ message: "Lesson not found" });

  if (!enrollment.completedLessons.some((id) => String(id) === String(lesson._id))) {
    enrollment.completedLessons.push(lesson._id);
  }
  enrollment.lastLessonId = lesson._id;

  const all = await courseLessons(req.params.courseId);
  const justCompleted = syncCompletion(enrollment, all);
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
