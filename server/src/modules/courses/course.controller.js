const mongoose = require("mongoose");
const Course = require("./Course.model");
const Lesson = require("../lessons/Lesson.model");
const Enrollment = require("../enrollments/Enrollment.model");
const Review = require("../reviews/Review.model");
const Doubt = require("../doubts/Doubt.model");
const Assessment = require("../assessments/Assessment.model");
const Submission = require("../submissions/Submission.model");
const QuizAttempt = require("../assessments/QuizAttempt.model");
const User = require("../users/User.model");
const { canManage } = require("../../shared/utils/access");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { DIFFICULTY } = require("../../shared/utils/constants");
const { isSafeImageUrl } = require("../../shared/utils/url");
const { percentOf } = require("../submissions/submission.shape");

const rx = (s) => new RegExp(String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

// Build an ordered [{ name, lessons, minutes }] summary from a course's lesson list.
function moduleSummary(lessons) {
  const order = [];
  const acc = {};
  for (const l of lessons) {
    if (!(l.module in acc)) {
      acc[l.module] = { count: 0, minutes: 0 };
      order.push(l.module);
    }
    acc[l.module].count += 1;
    acc[l.module].minutes += Number(l.durationMin) || 0;
  }
  return order.map((name) => ({ name, lessons: acc[name].count, minutes: acc[name].minutes }));
}

// How many of a student's completed lessons the course still shows. The raw
// list keeps ids of lessons since hidden (and, before deletes cleaned up after
// themselves, deleted), so its length alone could pass 100%.
const countVisibleDone = (completedIds, visibleIds) =>
  (completedIds || []).filter((id) => visibleIds.has(String(id))).length;

const totalMinutes = (lessons) => lessons.reduce((s, l) => s + (Number(l.durationMin) || 0), 0);

// GET /api/courses  — public catalog (published only)
// ?q= &category= &difficulty= &sort=newest|title|shortest|longest|rating &page= &limit=
exports.listPublished = asyncHandler(async (req, res) => {
  const { q, category, difficulty } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const filter = { published: true };
  if (q && q.trim()) filter.$or = [{ title: rx(q) }, { description: rx(q) }, { teacherName: rx(q) }];
  if (category && category.trim()) filter.category = category.trim();
  if (difficulty && DIFFICULTY.includes(difficulty)) filter.difficulty = difficulty;

  const sortMap = {
    newest: { createdAt: -1 },
    title: { title: 1 },
    // shortest / longest handled after we know minutes; default to newest here
  };
  const mongoSort = sortMap[req.query.sort] || { createdAt: -1 };

  // Pull the whole filtered set, then enrich; minute/rating sorts happen in
  // memory and pagination is a slice, so the total is just its length — a
  // separate countDocuments was one more round trip for a number we already
  // had. The category list doesn't depend on the set, so it rides along.
  let [courses, allCategories] = await Promise.all([
    // Covers are inline images and can be large; the whole set is read here,
    // so leave them out and fetch only the page's below.
    Course.find(filter).sort(mongoSort).select("-thumbnailUrl").lean(),
    Course.distinct("category", { published: true, category: { $ne: "" } }),
  ]);
  const total = courses.length;

  const ids = courses.map((c) => c._id);
  const [lessons, ratingAgg] = await Promise.all([
    Lesson.find({ course: { $in: ids }, published: { $ne: false } })
      .select("course module durationMin")
      .lean(),
    Review.aggregate([
      { $match: { course: { $in: ids } } },
      { $group: { _id: "$course", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]),
  ]);

  const byCourse = {};
  for (const l of lessons) (byCourse[l.course] ||= []).push(l);
  const rating = Object.fromEntries(
    ratingAgg.map((r) => [String(r._id), { rating: Math.round(r.avg * 10) / 10, reviewCount: r.count }])
  );

  courses = courses.map((c) => ({
    ...c,
    lessonCount: (byCourse[c._id] || []).length,
    minutes: totalMinutes(byCourse[c._id] || []),
    modules: moduleSummary(byCourse[c._id] || []),
    rating: rating[String(c._id)]?.rating || 0,
    reviewCount: rating[String(c._id)]?.reviewCount || 0,
  }));

  if (req.query.sort === "shortest") courses.sort((a, b) => a.minutes - b.minutes);
  if (req.query.sort === "longest") courses.sort((a, b) => b.minutes - a.minutes);
  if (req.query.sort === "rating") courses.sort((a, b) => b.rating - a.rating);

  const start = (page - 1) * limit;
  const pageCourses = courses.slice(start, start + limit);
  const covers = await Course.find({ _id: { $in: pageCourses.map((c) => c._id) } })
    .select("thumbnailUrl")
    .lean();
  const coverById = new Map(covers.map((c) => [String(c._id), c.thumbnailUrl || ""]));
  res.json({
    courses: pageCourses.map((c) => ({ ...c, thumbnailUrl: coverById.get(String(c._id)) || "" })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    categories: allCategories.sort((a, b) => a.localeCompare(b)),
  });
});

// GET /api/courses/manage  — teacher: own courses; admin: all courses
exports.listManaged = asyncHandler(async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { owner: req.user._id };
  const courses = await Course.find(filter)
    .sort({ createdAt: -1 })
    .populate("owner", "name email")
    .lean();
  const ids = courses.map((c) => c._id);

  const [lessonAgg, enrollAgg] = await Promise.all([
    Lesson.aggregate([{ $match: { course: { $in: ids } } }, { $group: { _id: "$course", n: { $sum: 1 } } }]),
    Enrollment.aggregate([{ $match: { course: { $in: ids } } }, { $group: { _id: "$course", n: { $sum: 1 } } }]),
  ]);
  const lc = Object.fromEntries(lessonAgg.map((x) => [String(x._id), x.n]));
  const ec = Object.fromEntries(enrollAgg.map((x) => [String(x._id), x.n]));

  res.json({
    courses: courses.map((c) => ({
      ...c,
      lessonCount: lc[String(c._id)] || 0,
      enrollmentCount: ec[String(c._id)] || 0,
    })),
  });
});

// GET /api/courses/:id  — detail + lessons (optionalAuth: managers can see unpublished)
exports.getOne = asyncHandler(async (req, res) => {
  // Same answer the CastError handler gives, before anything is queried
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Bad id in request" });
  const id = new mongoose.Types.ObjectId(req.params.id);

  // Everything here is keyed by the id in the URL, so it's fetched at once
  // rather than waiting on the course first: one round trip instead of two.
  // Lessons come back unfiltered and hidden ones are dropped below, before
  // anything is sent, for anyone who can't manage the course.
  const [course, allLessons, enrollmentCount, ratingAgg] = await Promise.all([
    Course.findById(id).populate("owner", "name email").lean(),
    Lesson.find({ course: id }).sort({ order: 1, createdAt: 1 }).lean(),
    Enrollment.countDocuments({ course: id }),
    Review.aggregate([
      { $match: { course: id } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]),
  ]);
  if (!course) return res.status(404).json({ message: "Course not found" });

  const isManager =
    req.user && (req.user.role === "admin" || String(course.owner?._id) === String(req.user._id));
  if (!course.published && !isManager) return res.status(404).json({ message: "Course not found" });

  const lessons = isManager ? allLessons : allLessons.filter((l) => l.published !== false);
  // This page is public. The owner's email is for the people managing the
  // course, not for every visitor — students see the name only.
  if (!isManager && course.owner) course.owner = { _id: course.owner._id, name: course.owner.name };

  res.json({
    course: {
      ...course,
      lessonCount: lessons.length,
      minutes: totalMinutes(lessons),
      modules: moduleSummary(lessons),
      enrollmentCount,
      rating: ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : 0,
      reviewCount: ratingAgg[0] ? ratingAgg[0].count : 0,
    },
    lessons,
    canManage: !!isManager,
  });
});

// POST /api/courses
exports.create = asyncHandler(async (req, res) => {
  const { title, description, teacherName, learn, hours, thumbnailUrl, category, difficulty, prerequisites, published } =
    req.body;
  if (!title) return res.status(400).json({ message: "Title is required" });
  if (!isSafeImageUrl(thumbnailUrl)) {
    return res.status(400).json({ message: "Cover image must be an uploaded image or an http(s) URL" });
  }

  const course = await Course.create({
    title,
    description: description || "",
    teacherName: teacherName || req.user.name,
    owner: req.user._id,
    learn: Array.isArray(learn) ? learn.map((s) => String(s).trim()).filter(Boolean) : [],
    prerequisites: Array.isArray(prerequisites)
      ? prerequisites.map((s) => String(s).trim()).filter(Boolean)
      : [],
    hours: Number(hours) || 0,
    thumbnailUrl: thumbnailUrl || "",
    category: (category || "").trim(),
    difficulty: DIFFICULTY.includes(difficulty) ? difficulty : "",
    // teachers start unpublished; admins may publish immediately
    published: req.user.role === "admin" ? !!published : false,
  });
  res.status(201).json({ course });
});

// PUT /api/courses/:id
exports.update = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found" });
  if (!canManage(req.user, course)) return res.status(403).json({ message: "Not your course" });

  const { title, description, teacherName, learn, hours, thumbnailUrl, category, difficulty, prerequisites } =
    req.body;
  if (title !== undefined) course.title = title;
  if (description !== undefined) course.description = description;
  if (teacherName !== undefined) course.teacherName = teacherName;
  if (learn !== undefined)
    course.learn = Array.isArray(learn) ? learn.map((s) => String(s).trim()).filter(Boolean) : [];
  if (prerequisites !== undefined)
    course.prerequisites = Array.isArray(prerequisites)
      ? prerequisites.map((s) => String(s).trim()).filter(Boolean)
      : [];
  if (hours !== undefined) course.hours = Number(hours) || 0;
  if (thumbnailUrl !== undefined) {
    if (!isSafeImageUrl(thumbnailUrl)) {
      return res.status(400).json({ message: "Cover image must be an uploaded image or an http(s) URL" });
    }
    course.thumbnailUrl = thumbnailUrl;
  }
  if (category !== undefined) course.category = String(category).trim();
  if (difficulty !== undefined) course.difficulty = DIFFICULTY.includes(difficulty) ? difficulty : "";
  await course.save();
  res.json({ course });
});

// PATCH /api/courses/:id/publish  { published }
exports.setPublished = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found" });
  if (!canManage(req.user, course)) return res.status(403).json({ message: "Not your course" });

  if (req.body.published) {
    const hasLessons = await Lesson.countDocuments({ course: course._id, published: { $ne: false } });
    if (!hasLessons)
      return res.status(400).json({ message: "Publish at least one lesson before publishing the course" });
  }
  course.published = !!req.body.published;
  await course.save();
  res.json({ course });
});

// PATCH /api/courses/:id/owner  { ownerId, keepTeacherName? }  (admin)
exports.reassignOwner = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found" });

  const newOwner = await User.findById(req.body.ownerId);
  if (!newOwner || newOwner.role === "student") {
    return res.status(400).json({ message: "New owner must be a teacher or admin" });
  }
  course.owner = newOwner._id;
  if (!req.body.keepTeacherName) course.teacherName = newOwner.name;
  await course.save();
  res.json({ course });
});

// DELETE /api/courses/:id
exports.remove = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found" });
  if (!canManage(req.user, course)) return res.status(403).json({ message: "Not your course" });

  // Everything that points at this course goes with it. Doubts and reviews are
  // on this list because they were missed once: they survived the course and
  // left the student's Doubts page showing a question against a blank course.
  // Anything that gains a `course` field belongs here too.
  await Promise.all([
    Lesson.deleteMany({ course: course._id }),
    Enrollment.deleteMany({ course: course._id }),
    Assessment.deleteMany({ course: course._id }),
    Submission.deleteMany({ course: course._id }),
    QuizAttempt.deleteMany({ course: course._id }),
    Doubt.deleteMany({ course: course._id }),
    Review.deleteMany({ course: course._id }),
    course.deleteOne(),
  ]);
  res.json({ message: "Course deleted" });
});

// GET /api/courses/:id/enrollments  (owner teacher or admin)
exports.courseEnrollments = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found" });
  if (!canManage(req.user, course)) return res.status(403).json({ message: "Not your course" });

  const [visible, enrolls] = await Promise.all([
    Lesson.find({ course: course._id, published: { $ne: false } }).distinct("_id"),
    Enrollment.find({ course: course._id })
      .populate("student", "name email")
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  const visibleIds = new Set(visible.map(String));
  const total = visibleIds.size;

  res.json({
    course: { _id: course._id, title: course.title },
    total,
    enrollments: enrolls
      .filter((e) => e.student)
      .map((e) => {
        const completed = countVisibleDone(e.completedLessons, visibleIds);
        return {
          _id: e._id,
          student: e.student,
          completed,
          total,
          percent: total ? Math.round((completed / total) * 100) : 0,
          enrolledAt: e.createdAt,
        };
      }),
  });
});

// GET /api/courses/:id/performance  (owner teacher or admin)
exports.performance = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found" });
  if (!canManage(req.user, course)) return res.status(403).json({ message: "Not your course" });

  const [lessons, enrolls, assessments, submissions] = await Promise.all([
    Lesson.find({ course: course._id, published: { $ne: false } })
      .sort({ order: 1, createdAt: 1 })
      .select("title module")
      .lean(),
    Enrollment.find({ course: course._id })
      .select("completedLessons updatedAt")
      .lean(),
    Assessment.find({ course: course._id })
      .sort({ createdAt: -1 })
      .select("title kind points passPercent published")
      .lean(),
    Submission.find({ course: course._id })
      .select("assessment score autoScore status")
      .lean(),
  ]);

  const enrolled = enrolls.length;
  const totalLessons = lessons.length;
  const visibleIds = new Set(lessons.map((l) => String(l._id)));
  // Live, not the stored status — that goes stale when lessons are added.
  const completedCourse = totalLessons
    ? enrolls.filter((e) => countVisibleDone(e.completedLessons, visibleIds) >= totalLessons).length
    : 0;
  const avgPercent =
    enrolled && totalLessons
      ? Math.round(
          (enrolls.reduce(
            (s, e) => s + countVisibleDone(e.completedLessons, visibleIds) / totalLessons,
            0
          ) /
            enrolled) *
            100
        )
      : 0;

  const now = Date.now();
  const active7 = enrolls.filter((e) => now - new Date(e.updatedAt) < 7 * 86400000).length;

  const subsByAssessment = new Map();
  submissions.forEach((s) => {
    const key = String(s.assessment);
    if (!subsByAssessment.has(key)) subsByAssessment.set(key, []);
    subsByAssessment.get(key).push(s);
  });

  res.json({
    course: { _id: course._id, title: course.title },
    enrolled,
    completedCourse,
    completionRate: enrolled ? Math.round((completedCourse / enrolled) * 100) : 0,
    avgPercent,
    active7,
    totalLessons,
    assessments: assessments.map((a) => {
      const subs = subsByAssessment.get(String(a._id)) || [];
      // The one shared rule (submission.shape) — `null` is "not scored yet" and
      // stays out of the average rather than counting as 0.
      const scored = subs.map((s) => percentOf(s, a)).filter((p) => p != null);
      const avg = scored.length
        ? Math.round(scored.reduce((s, p) => s + p, 0) / scored.length)
        : null;

      return {
        _id: a._id,
        title: a.title,
        kind: a.kind,
        published: a.published,
        submissions: subs.length,
        graded: subs.filter((s) => s.status === "graded").length,
        avgScore: avg,
        // Only a quiz carries a pass mark the teacher actually set. An assignment
        // has `passPercent` in the schema with a default of 60 that no screen ever
        // shows, so reporting a pass rate against it would be a number nobody chose.
        passRate:
          a.kind === "quiz" && scored.length
            ? Math.round(
                (scored.filter((p) => p >= (a.passPercent || 0)).length / scored.length) * 100
              )
            : null,
      };
    }),
  });
});
