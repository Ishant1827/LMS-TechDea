const Assessment = require("../models/Assessment");
const Submission = require("../models/Submission");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const asyncHandler = require("../utils/asyncHandler");
const { ASSESSMENT_KINDS } = require("../utils/constants");

const canManage = (user, course) =>
  user.role === "admin" || String(course.owner) === String(user._id);

// Auto-grade a quiz attempt -> percentage 0..100.
function gradeQuiz(questions, answers = []) {
  if (!questions.length) return 0;
  let correct = 0;
  questions.forEach((q, i) => {
    if (Number(answers[i]) === q.correctIndex) correct += 1;
  });
  return Math.round((correct / questions.length) * 100);
}

// A single 0..100 figure for either kind (assignment score is out of `points`).
function percentOf(sub, a) {
  if (!sub || sub.score == null) return null;
  if (a.kind === "quiz") return Math.round(sub.score);
  const max = a.points || 100;
  return max ? Math.round((sub.score / max) * 100) : 0;
}

// Client-facing submission object.
function shapeSubmission(sub, a) {
  if (!sub) return null;
  const percent = percentOf(sub, a);
  return {
    _id: sub._id,
    status: sub.status,
    text: sub.text || "",
    link: sub.link || "",
    answers: sub.answers || [],
    autoScore: sub.autoScore,
    score: sub.score,
    percent,
    passed: percent == null ? null : percent >= (a.passPercent || 0),
    feedback: sub.feedback || "",
    submittedAt: sub.submittedAt,
    gradedAt: sub.gradedAt,
    student: sub.student, // populated where relevant
  };
}

// Strip answer keys unless the caller is allowed to see them.
function shapeQuestions(a, reveal) {
  return (a.questions || []).map((q) => ({
    _id: q._id,
    text: q.text,
    options: q.options,
    ...(reveal ? { correctIndex: q.correctIndex } : {}),
  }));
}

function sanitizeQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q) => {
      const text = String(q.text || "").trim();
      const options = (Array.isArray(q.options) ? q.options : [])
        .map((o) => String(o || "").trim())
        .filter(Boolean);
      let correctIndex = Number(q.correctIndex);
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        correctIndex = 0;
      }
      return { text, options, correctIndex };
    })
    .filter((q) => q.text && q.options.length >= 2);
}

// Load an assessment for a manager route, 404/403 as needed. Returns { assessment, course }.
async function loadForManage(id, user) {
  const assessment = await Assessment.findById(id);
  if (!assessment) return { err: [404, "Assessment not found"] };
  const course = await Course.findById(assessment.course);
  if (!course) return { err: [404, "Course not found"] };
  if (!canManage(user, course)) return { err: [403, "Not your course"] };
  return { assessment, course };
}

// ── student: everything assigned to me ──────────────────────────────────────
// GET /api/assessments/mine
exports.mine = asyncHandler(async (req, res) => {
  const courseIds = await Enrollment.find({ student: req.user._id }).distinct("course");

  const [assessments, subs] = await Promise.all([
    Assessment.find({ course: { $in: courseIds }, published: true })
      .populate("course", "title")
      .sort({ dueAt: 1, createdAt: -1 })
      .lean(),
    Submission.find({ student: req.user._id }).lean(),
  ]);
  const subByAssessment = new Map(subs.map((s) => [String(s.assessment), s]));

  res.json({
    assessments: assessments
      .filter((a) => a.course)
      .map((a) => ({
        _id: a._id,
        kind: a.kind,
        title: a.title,
        instructions: a.instructions,
        dueAt: a.dueAt,
        points: a.points,
        passPercent: a.passPercent,
        timeLimitMin: a.timeLimitMin,
        questionCount: (a.questions || []).length,
        course: a.course,
        submission: shapeSubmission(subByAssessment.get(String(a._id)), a),
      })),
  });
});

// ── manager: assessments for one course ─────────────────────────────────────
// GET /api/assessments?courseId=...
exports.listForCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.query.courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });
  if (!canManage(req.user, course)) return res.status(403).json({ message: "Not your course" });

  const [assessments, enrolledCount, subAgg] = await Promise.all([
    Assessment.find({ course: course._id }).sort({ createdAt: -1 }).lean(),
    Enrollment.countDocuments({ course: course._id }),
    Submission.aggregate([
      { $match: { course: course._id } },
      {
        $group: {
          _id: "$assessment",
          submitted: { $sum: 1 },
          graded: { $sum: { $cond: [{ $eq: ["$status", "graded"] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const stats = Object.fromEntries(subAgg.map((s) => [String(s._id), s]));

  res.json({
    course: { _id: course._id, title: course.title },
    enrolledCount,
    assessments: assessments.map((a) => ({
      ...a,
      submittedCount: stats[String(a._id)]?.submitted || 0,
      gradedCount: stats[String(a._id)]?.graded || 0,
    })),
  });
});

// ── detail ─────────────────────────────────────────────────────────────────
// GET /api/assessments/:id
exports.getOne = asyncHandler(async (req, res) => {
  const a = await Assessment.findById(req.params.id).lean();
  if (!a) return res.status(404).json({ message: "Assessment not found" });

  const course = await Course.findById(a.course).select("owner title").lean();
  const manager = course && canManage(req.user, course);

  if (manager) {
    return res.json({ assessment: { ...a, course: { _id: course._id, title: course.title } } });
  }

  // student — must be enrolled, assessment must be published
  const enrolled = await Enrollment.exists({ student: req.user._id, course: a.course });
  if (!a.published || !enrolled) return res.status(404).json({ message: "Assessment not found" });

  const sub = await Submission.findOne({ assessment: a._id, student: req.user._id }).lean();
  const reveal = a.kind === "quiz" && !!sub; // show the answer key only after they've attempted it

  res.json({
    assessment: {
      _id: a._id,
      kind: a.kind,
      title: a.title,
      instructions: a.instructions,
      dueAt: a.dueAt,
      points: a.points,
      passPercent: a.passPercent,
      timeLimitMin: a.timeLimitMin,
      questions: shapeQuestions(a, reveal),
      questionCount: (a.questions || []).length,
      course: { _id: course._id, title: course.title },
    },
    submission: shapeSubmission(sub, a),
  });
});

// ── create / update / delete / publish (manager) ───────────────────────────
// POST /api/assessments   { courseId, kind, title, ... }
exports.create = asyncHandler(async (req, res) => {
  const { courseId, kind, title } = req.body;
  if (!ASSESSMENT_KINDS.includes(kind)) {
    return res.status(400).json({ message: "kind must be 'assignment' or 'quiz'" });
  }
  if (!title || !title.trim()) return res.status(400).json({ message: "Title is required" });

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });
  if (!canManage(req.user, course)) return res.status(403).json({ message: "Not your course" });

  const doc = {
    course: course._id,
    kind,
    title: title.trim(),
    instructions: String(req.body.instructions || "").slice(0, 8000),
    dueAt: req.body.dueAt ? new Date(req.body.dueAt) : null,
    published: !!req.body.published,
    createdBy: req.user._id,
  };
  if (kind === "assignment") {
    doc.points = Math.min(1000, Math.max(1, Number(req.body.points) || 100));
  } else {
    doc.questions = sanitizeQuestions(req.body.questions);
    doc.passPercent = Math.min(100, Math.max(0, Number(req.body.passPercent) || 60));
    doc.timeLimitMin = Math.min(600, Math.max(0, Number(req.body.timeLimitMin) || 0));
    if (doc.published && !doc.questions.length) {
      return res.status(400).json({ message: "Add at least one question before publishing a quiz" });
    }
  }

  const assessment = await Assessment.create(doc);
  res.status(201).json({ assessment });
});

// PUT /api/assessments/:id
exports.update = asyncHandler(async (req, res) => {
  const { assessment, err } = await loadForManage(req.params.id, req.user);
  if (err) return res.status(err[0]).json({ message: err[1] });

  const b = req.body;
  if (b.title !== undefined) assessment.title = String(b.title).trim();
  if (b.instructions !== undefined) assessment.instructions = String(b.instructions).slice(0, 8000);
  if (b.dueAt !== undefined) assessment.dueAt = b.dueAt ? new Date(b.dueAt) : null;

  if (assessment.kind === "assignment") {
    if (b.points !== undefined) assessment.points = Math.min(1000, Math.max(1, Number(b.points) || 100));
  } else {
    if (b.questions !== undefined) assessment.questions = sanitizeQuestions(b.questions);
    if (b.passPercent !== undefined)
      assessment.passPercent = Math.min(100, Math.max(0, Number(b.passPercent) || 60));
    if (b.timeLimitMin !== undefined)
      assessment.timeLimitMin = Math.min(600, Math.max(0, Number(b.timeLimitMin) || 0));
  }

  if (b.published !== undefined) {
    if (b.published && assessment.kind === "quiz" && !assessment.questions.length) {
      return res.status(400).json({ message: "Add at least one question before publishing a quiz" });
    }
    assessment.published = !!b.published;
  }

  await assessment.save();
  res.json({ assessment });
});

// PATCH /api/assessments/:id/publish   { published }
exports.setPublished = asyncHandler(async (req, res) => {
  const { assessment, err } = await loadForManage(req.params.id, req.user);
  if (err) return res.status(err[0]).json({ message: err[1] });

  if (req.body.published && assessment.kind === "quiz" && !assessment.questions.length) {
    return res.status(400).json({ message: "Add at least one question before publishing a quiz" });
  }
  assessment.published = !!req.body.published;
  await assessment.save();
  res.json({ assessment });
});

// DELETE /api/assessments/:id
exports.remove = asyncHandler(async (req, res) => {
  const { assessment, err } = await loadForManage(req.params.id, req.user);
  if (err) return res.status(err[0]).json({ message: err[1] });

  await Promise.all([
    Submission.deleteMany({ assessment: assessment._id }),
    assessment.deleteOne(),
  ]);
  res.json({ message: "Assessment deleted" });
});

// ── submit (student) ───────────────────────────────────────────────────────
// POST /api/assessments/:id/submit   assignment: { text, link }   quiz: { answers }
exports.submit = asyncHandler(async (req, res) => {
  const a = await Assessment.findById(req.params.id);
  if (!a || !a.published) return res.status(404).json({ message: "Assessment not found" });

  const enrolled = await Enrollment.exists({ student: req.user._id, course: a.course });
  if (!enrolled) return res.status(403).json({ message: "Enrol in the course first" });

  const existing = await Submission.findOne({ assessment: a._id, student: req.user._id });
  if (existing) return res.status(409).json({ message: "You've already submitted this" });

  const doc = {
    assessment: a._id,
    course: a.course,
    student: req.user._id,
    kind: a.kind,
    submittedAt: new Date(),
    status: "submitted",
  };

  if (a.kind === "assignment") {
    const text = String(req.body.text || "").trim();
    const link = String(req.body.link || "").trim();
    if (!text && !link) return res.status(400).json({ message: "Write an answer or paste a link" });
    doc.text = text.slice(0, 20000);
    doc.link = link.slice(0, 2000);
  } else {
    const answers = (Array.isArray(req.body.answers) ? req.body.answers : []).map((n) => {
      const v = Number(n);
      return Number.isInteger(v) ? v : -1;
    });
    doc.answers = a.questions.map((_, i) => (answers[i] == null ? -1 : answers[i]));
    doc.autoScore = gradeQuiz(a.questions, doc.answers);
    doc.score = doc.autoScore; // quizzes grade themselves; teacher may override later
    doc.status = "graded";
    doc.gradedAt = new Date();
  }

  const sub = await Submission.create(doc);
  res.status(201).json({ submission: shapeSubmission(sub, a) });
});

// ── submissions inbox (manager) ────────────────────────────────────────────
// GET /api/assessments/:id/submissions
exports.submissions = asyncHandler(async (req, res) => {
  const a = await Assessment.findById(req.params.id).lean();
  if (!a) return res.status(404).json({ message: "Assessment not found" });
  const course = await Course.findById(a.course).select("owner title").lean();
  if (!course || !canManage(req.user, course)) {
    return res.status(403).json({ message: "Not your course" });
  }

  const [subs, enrolls] = await Promise.all([
    Submission.find({ assessment: a._id }).populate("student", "name email").sort({ submittedAt: 1 }).lean(),
    Enrollment.find({ course: a.course }).populate("student", "name email").lean(),
  ]);
  const submittedIds = new Set(subs.map((s) => String(s.student?._id)));

  res.json({
    assessment: {
      _id: a._id,
      kind: a.kind,
      title: a.title,
      points: a.points,
      passPercent: a.passPercent,
      questionCount: (a.questions || []).length,
      questions: shapeQuestions(a, true),
      course: { _id: course._id, title: course.title },
    },
    submissions: subs
      .filter((s) => s.student)
      .map((s) => ({ ...shapeSubmission(s, a), student: s.student })),
    // enrolled students who haven't turned anything in yet
    missing: enrolls
      .filter((e) => e.student && !submittedIds.has(String(e.student._id)))
      .map((e) => ({ _id: e.student._id, name: e.student.name, email: e.student.email })),
  });
});
