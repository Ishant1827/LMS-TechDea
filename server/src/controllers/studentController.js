const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const Enrollment = require("../models/Enrollment");
const asyncHandler = require("../utils/asyncHandler");

const DAY = 86400000;
const STALLED_DAYS = 14;

// GET /api/students?q=&filter=all|stalled|completed|notstarted   (teacher/admin)
// A roster of every student enrolled in any course you manage.
exports.roster = asyncHandler(async (req, res) => {
  const courseFilter = req.user.role === "admin" ? {} : { owner: req.user._id };
  const courses = await Course.find(courseFilter).select("title").lean();
  const courseIds = courses.map((c) => c._id);
  const titleById = Object.fromEntries(courses.map((c) => [String(c._id), c.title]));

  const [enrolls, lessonCounts] = await Promise.all([
    Enrollment.find({ course: { $in: courseIds } }).populate("student", "name email").lean(),
    Lesson.aggregate([
      { $match: { course: { $in: courseIds }, published: { $ne: false } } },
      { $group: { _id: "$course", n: { $sum: 1 } } },
    ]),
  ]);
  const totalById = Object.fromEntries(lessonCounts.map((x) => [String(x._id), x.n]));

  const byStudent = new Map();
  for (const e of enrolls) {
    if (!e.student) continue;
    const sid = String(e.student._id);
    if (!byStudent.has(sid)) {
      byStudent.set(sid, { student: e.student, courses: [], lastActive: null });
    }
    const total = totalById[String(e.course)] || 0;
    const completed = Math.min((e.completedLessons || []).length, total);
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const rec = byStudent.get(sid);
    rec.courses.push({
      courseId: e.course,
      title: titleById[String(e.course)] || "—",
      percent,
      completed,
      total,
      status: e.status,
      lastActive: e.updatedAt,
    });
    if (!rec.lastActive || e.updatedAt > rec.lastActive) rec.lastActive = e.updatedAt;
  }

  const now = Date.now();
  let rows = [...byStudent.values()].map((r) => {
    const overall = r.courses.length
      ? Math.round(r.courses.reduce((s, c) => s + c.percent, 0) / r.courses.length)
      : 0;
    const completedCount = r.courses.filter((c) => c.status === "completed").length;
    const daysIdle = r.lastActive ? Math.floor((now - new Date(r.lastActive)) / DAY) : 9999;
    return {
      student: r.student,
      courses: r.courses,
      lastActive: r.lastActive,
      overall,
      completedCount,
      enrolledCount: r.courses.length,
      daysIdle,
      stalled: daysIdle >= STALLED_DAYS && overall > 0 && overall < 100,
      notStarted: overall === 0,
    };
  });

  const q = (req.query.q || "").trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.student.name.toLowerCase().includes(q) || r.student.email.toLowerCase().includes(q)
    );
  }
  switch (req.query.filter) {
    case "stalled":
      rows = rows.filter((r) => r.stalled);
      break;
    case "completed":
      rows = rows.filter((r) => r.completedCount > 0);
      break;
    case "notstarted":
      rows = rows.filter((r) => r.notStarted);
      break;
  }

  rows.sort((a, b) => new Date(b.lastActive || 0) - new Date(a.lastActive || 0));
  res.json({ students: rows, courseCount: courses.length });
});
