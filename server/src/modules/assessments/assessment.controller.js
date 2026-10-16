const Assessment = require("./Assessment.model");
const QuizAttempt = require("./QuizAttempt.model");
const Submission = require("../submissions/Submission.model");
const Course = require("../courses/Course.model");
const Enrollment = require("../enrollments/Enrollment.model");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { ASSESSMENT_KINDS } = require("../../shared/utils/constants");
const { isSafeUrl, LINK_ERROR } = require("../../shared/utils/url");
const { canManage } = require("../../shared/utils/access");
const { shapeSubmission } = require("../submissions/submission.shape");

// A due date is an instant, and the instant a teacher means is Indian time.
// The builder sends a full ISO string, so this is mostly a parse guard — but a
// bare "2026-10-15" from a direct API call is read as the *end* of that day in
// IST, which is what a person means by it, rather than midnight UTC, which is
// what JavaScript would otherwise decide and is 5.5 hours before the day even
// starts here. Anything unparseable becomes no due date rather than an
// Invalid Date that fails at save time.
function parseDueAt(v) {
  if (!v) return null;
  const s = String(v).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T23:59:59.999+05:30`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// How a deadline is spoken to the person who missed it. Indian time, said so.
const IST_FORMAT = {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};
const fmtIst = (d) => `${new Date(d).toLocaleString("en-IN", IST_FORMAT)} IST`;

// A minute of slack on the deadline, for the gap between the student's clock
// and this server's. It is tolerance for skew, not leniency: the screen shows
// the real deadline and the countdown ends there.
const CLOCK_SKEW_MS = 60 * 1000;

// A timed quiz runs on the server's clock (see QuizAttempt). The minute of
// grace covers the trip from the browser's auto-submit to here on a slow
// connection; it is not extra time, and the page's countdown ends without it.
const TIME_LIMIT_GRACE_MS = 60 * 1000;

const isTimed = (a) => a.kind === "quiz" && a.timeLimitMin > 0;

// When this attempt's time runs out: the limit from when they started, cut
// short by the due date if that comes first.
function attemptEndsAt(a, attempt) {
  const byLimit = new Date(attempt.startedAt).getTime() + a.timeLimitMin * 60 * 1000;
  const end = a.dueAt ? Math.min(byLimit, new Date(a.dueAt).getTime()) : byLimit;
  return new Date(end);
}

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

// Same number of questions, each with the same number of options and the same
// right answer — only the words may differ.
function sameQuizShape(before, after) {
  if (before.length !== after.length) return false;
  return before.every(
    (q, i) => q.options.length === after[i].options.length && q.correctIndex === after[i].correctIndex
  );
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

  const [sub, attempt] = await Promise.all([
    Submission.findOne({ assessment: a._id, student: req.user._id }).lean(),
    isTimed(a) ? QuizAttempt.findOne({ assessment: a._id, student: req.user._id }).lean() : null,
  ]);
  // The answer key waits for the due date as well as the attempt. Shown on
  // submit, the first student to finish could hand the answers to everyone
  // still to take it. With no due date there is no moment when the whole class
  // is done, so the key is never shown — the score still is.
  const keyOpen = !!a.dueAt && Date.now() > new Date(a.dueAt).getTime();
  const reveal = a.kind === "quiz" && !!sub && keyOpen;
  // A timed quiz keeps its questions back until the clock is started — read
  // them first and the time limit would only cover clicking the answers.
  const needsStart = isTimed(a) && !sub && !attempt;

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
      questions: needsStart ? [] : shapeQuestions(a, reveal),
      questionCount: (a.questions || []).length,
      course: { _id: course._id, title: course.title },
    },
    submission: shapeSubmission(sub, a),
    answersShown: reveal,
    needsStart,
    attempt: attempt
      ? { startedAt: attempt.startedAt, endsAt: attemptEndsAt(a, attempt), graceMs: TIME_LIMIT_GRACE_MS }
      : null,
    // the page counts down against this, not the student's own clock
    serverNow: new Date(),
  });
});

// POST /api/assessments/:id/start  — start the clock on a timed quiz (student)
//
// Starting twice is not an error and does not reset anything: the first start
// time is kept, which is the whole point.
exports.start = asyncHandler(async (req, res) => {
  const a = await Assessment.findById(req.params.id).lean();
  if (!a || !a.published) return res.status(404).json({ message: "Assessment not found" });
  if (!isTimed(a)) return res.status(400).json({ message: "This quiz has no time limit" });

  const enrolled = await Enrollment.exists({ student: req.user._id, course: a.course });
  if (!enrolled) return res.status(403).json({ message: "Enrol in the course first" });

  const existing = await QuizAttempt.findOne({ assessment: a._id, student: req.user._id }).lean();
  if (!existing) {
    if (await Submission.exists({ assessment: a._id, student: req.user._id })) {
      return res.status(409).json({ message: "You've already submitted this" });
    }
    if (a.dueAt && Date.now() > new Date(a.dueAt).getTime()) {
      return res.status(400).json({ message: `This closed on ${fmtIst(a.dueAt)}.` });
    }
  }

  const attempt = await QuizAttempt.findOneAndUpdate(
    { assessment: a._id, student: req.user._id },
    { $setOnInsert: { assessment: a._id, course: a.course, student: req.user._id, startedAt: new Date() } },
    { upsert: true, new: true }
  ).lean();

  res.json({ attempt: { startedAt: attempt.startedAt, endsAt: attemptEndsAt(a, attempt) } });
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
    dueAt: parseDueAt(req.body.dueAt),
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
  if (b.dueAt !== undefined) assessment.dueAt = parseDueAt(b.dueAt);

  if (assessment.kind === "assignment") {
    if (b.points !== undefined) {
      const points = Math.min(1000, Math.max(1, Number(b.points) || 100));
      // Marks already given are out of the old total. Dropping the total below
      // one of them would turn 80/100 into 160%.
      if (points < assessment.points) {
        const top = await Submission.findOne({ assessment: assessment._id, score: { $ne: null } })
          .sort({ score: -1 })
          .select("score")
          .lean();
        if (top && top.score > points) {
          return res.status(400).json({
            message: `Some work is already marked ${top.score} — the total can't go below that.`,
          });
        }
      }
      assessment.points = points;
    }
  } else {
    if (b.questions !== undefined) {
      const next = sanitizeQuestions(b.questions);
      // Once someone has taken the quiz their answers are positions in these
      // questions, and their score was worked out from this key. Fixing the
      // wording is fine; adding, removing or reordering questions or options,
      // or moving the right answer, would make their results mean something else.
      if (!sameQuizShape(assessment.questions, next)) {
        const taken = await Submission.exists({ assessment: assessment._id });
        if (taken) {
          return res.status(400).json({
            message:
              "Students have already taken this quiz, so questions and answers can't be added, removed or changed. You can still fix the wording.",
          });
        }
      }
      assessment.questions = next;
    }
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
    QuizAttempt.deleteMany({ assessment: assessment._id }),
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

  // One submission per student, still. The only way back in is the teacher
  // sending the work back (PATCH /api/submissions/:id/return) — a student can
  // neither edit nor withdraw what they handed in.
  const existing = await Submission.findOne({ assessment: a._id, student: req.user._id });
  if (existing && existing.status !== "returned") {
    return res.status(409).json({ message: "You've already submitted this" });
  }

  // The deadline is real: work that arrives after it is refused, not quietly
  // accepted and marked late. There is exactly one way past it and it belongs
  // to the teacher — a submission they sent back stays open, because reopening
  // it was their deliberate act, and moving the due date reopens it for the
  // whole class. Neither is something a student can do to themselves.
  const reopened = existing && existing.status === "returned";
  if (a.dueAt && !reopened && Date.now() > a.dueAt.getTime() + CLOCK_SKEW_MS) {
    return res.status(400).json({
      message: `This closed on ${fmtIst(a.dueAt)}. Ask your teacher to extend the due date.`,
    });
  }

  // A timed quiz is held to the clock the server started, not the page's.
  // A refresh no longer buys a fresh countdown, and answers that arrive after
  // the time ran out (plus the grace for the trip here) are refused.
  if (isTimed(a)) {
    const attempt = await QuizAttempt.findOne({ assessment: a._id, student: req.user._id }).lean();
    if (!attempt) return res.status(400).json({ message: "Start the quiz first" });
    if (Date.now() > attemptEndsAt(a, attempt).getTime() + TIME_LIMIT_GRACE_MS) {
      return res.status(400).json({ message: "Time ran out on this quiz, so it can't be submitted now." });
    }
  }

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
    // The teacher clicks this link while grading — it must not be script.
    if (!isSafeUrl(link)) return res.status(400).json({ message: LINK_ERROR });
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

  // A returned assignment is the same record handed in again — the row is
  // updated rather than replaced, so the unique (assessment, student) pair
  // holds and the teacher's note stays attached until they grade it.
  if (existing) {
    Object.assign(existing, doc, { returnedAt: null });
    await existing.save();
    return res.json({ submission: shapeSubmission(existing, a) });
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
