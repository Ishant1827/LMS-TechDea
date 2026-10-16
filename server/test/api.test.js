// End-to-end tests for the API: real Express app, real Mongoose, a real
// MongoDB — but only a throwaway LOCAL test database, which is wiped before
// and after the run.
//
//   npm test                      (needs MongoDB running on this machine)
//   TEST_MONGO_URI=... npm test   (any database whose name ends in "_test")
//
// Each block below covers one item from the 2026-10 review (FIXES.md), so a
// regression names the rule it broke.

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/techdea_test";
process.env.JWT_SECRET = "test-only-secret";
process.env.NODE_ENV = "test";
process.env.CLIENT_ORIGIN = "http://localhost";

const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const app = require("../src/app");
const User = require("../src/modules/users/User.model");
const Course = require("../src/modules/courses/Course.model");
const Lesson = require("../src/modules/lessons/Lesson.model");
const Enrollment = require("../src/modules/enrollments/Enrollment.model");
const Assessment = require("../src/modules/assessments/Assessment.model");
const QuizAttempt = require("../src/modules/assessments/QuizAttempt.model");
const { signToken } = require("../src/shared/utils/token");

let srv;
let base;
const ctx = {};

async function call(method, url, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}

async function makeUser(name, role) {
  const u = new User({ name, email: `${name.toLowerCase()}@example.test`, role });
  await u.setPassword("testpass123");
  await u.save();
  return { u, t: signToken(u) };
}

const questions = [
  { text: "1+1", options: ["1", "2"], correctIndex: 1 },
  { text: "2+2", options: ["4", "5"], correctIndex: 0 },
];

before(async () => {
  await connectDB();
  // Safety: never run against anything that is not plainly a test database.
  if (!mongoose.connection.name.endsWith("_test")) {
    throw new Error(`Refusing to run tests against "${mongoose.connection.name}" — use a *_test database`);
  }
  await mongoose.connection.dropDatabase();
  srv = app.listen(0);
  base = `http://127.0.0.1:${srv.address().port}/api`;

  ctx.admin = await makeUser("Admin", "admin");
  ctx.teacher = await makeUser("Teacher", "teacher");
  ctx.s1 = await makeUser("Studentone", "student");
  ctx.s2 = await makeUser("Studenttwo", "student");
  ctx.s3 = await makeUser("Studentthree", "student");

  ctx.course = await Course.create({ title: "C", owner: ctx.teacher.u._id, published: true });
  ctx.lessons = await Lesson.create([
    { course: ctx.course._id, title: "L1", order: 0 },
    { course: ctx.course._id, title: "L2", order: 1 },
    { course: ctx.course._id, title: "L3 draft", order: 2, published: false },
  ]);
  for (const s of [ctx.s1, ctx.s2, ctx.s3]) {
    await Enrollment.create({ student: s.u._id, course: ctx.course._id });
  }
  const make = (fields) => Assessment.create({ course: ctx.course._id, published: true, ...fields });
  ctx.timed = await make({ kind: "quiz", title: "Timed", questions, timeLimitMin: 1 });
  ctx.untimed = await make({ kind: "quiz", title: "Untimed", questions });
  ctx.dated = await make({ kind: "quiz", title: "Dated", questions, dueAt: new Date(Date.now() + 86400000) });
  ctx.assign = await make({ kind: "assignment", title: "A", points: 10 });
});

after(async () => {
  if (mongoose.connection.readyState === 1 && mongoose.connection.name.endsWith("_test")) {
    await mongoose.connection.dropDatabase();
  }
  srv?.close();
  await mongoose.connection.close();
});

describe("#2 timed quiz runs on the server's clock", () => {
  test("questions are hidden until the quiz is started", async () => {
    const r = await call("GET", `/assessments/${ctx.timed._id}`, ctx.s1.t);
    assert.equal(r.body.needsStart, true);
    assert.equal(r.body.assessment.questions.length, 0);
  });

  test("submitting before starting is refused", async () => {
    const r = await call("POST", `/assessments/${ctx.timed._id}/submit`, ctx.s1.t, { answers: [1, 0] });
    assert.equal(r.status, 400);
  });

  test("starting again keeps the first start time", async () => {
    const a = await call("POST", `/assessments/${ctx.timed._id}/start`, ctx.s1.t);
    const b = await call("POST", `/assessments/${ctx.timed._id}/start`, ctx.s1.t);
    assert.equal(new Date(a.body.attempt.endsAt) - new Date(a.body.attempt.startedAt), 60000);
    assert.equal(b.body.attempt.startedAt, a.body.attempt.startedAt);
  });

  test("answers after the time plus 1 minute of grace are refused", async () => {
    await QuizAttempt.updateOne(
      { assessment: ctx.timed._id, student: ctx.s1.u._id },
      { $set: { startedAt: new Date(Date.now() - 2.5 * 60000) } }
    );
    const r = await call("POST", `/assessments/${ctx.timed._id}/submit`, ctx.s1.t, { answers: [1, 0] });
    assert.equal(r.status, 400);
  });

  test("answers inside the grace minute are accepted and scored", async () => {
    await QuizAttempt.updateOne(
      { assessment: ctx.timed._id, student: ctx.s1.u._id },
      { $set: { startedAt: new Date(Date.now() - 90000) } }
    );
    const r = await call("POST", `/assessments/${ctx.timed._id}/submit`, ctx.s1.t, { answers: [1, 0] });
    assert.equal(r.status, 201);
    assert.equal(r.body.submission.percent, 100);
  });

  test("an untimed quiz needs no start, and can't be started", async () => {
    const r = await call("POST", `/assessments/${ctx.untimed._id}/submit`, ctx.s1.t, { answers: [1, 1] });
    assert.equal(r.status, 201);
    const s = await call("POST", `/assessments/${ctx.untimed._id}/start`, ctx.s1.t);
    assert.equal(s.status, 400);
  });
});

describe("#3 answer key waits for the due date", () => {
  test("no due date: score shown, answers never", async () => {
    const r = await call("GET", `/assessments/${ctx.untimed._id}`, ctx.s1.t);
    assert.equal(r.body.answersShown, false);
    assert.equal(r.body.submission.percent, 50);
    assert.ok(r.body.assessment.questions.every((q) => q.correctIndex === undefined));
  });

  test("due date in the future: hidden; once it passes: shown", async () => {
    await call("POST", `/assessments/${ctx.dated._id}/submit`, ctx.s1.t, { answers: [1, 0] });
    let r = await call("GET", `/assessments/${ctx.dated._id}`, ctx.s1.t);
    assert.equal(r.body.answersShown, false);
    await Assessment.updateOne({ _id: ctx.dated._id }, { $set: { dueAt: new Date(Date.now() - 1000) } });
    r = await call("GET", `/assessments/${ctx.dated._id}`, ctx.s1.t);
    assert.equal(r.body.answersShown, true);
    assert.equal(r.body.assessment.questions[0].correctIndex, 1);
  });
});

describe("#4 a grade needs marks", () => {
  test("feedback alone stays 'submitted'; with marks it is 'graded'", async () => {
    const s = await call("POST", `/assessments/${ctx.assign._id}/submit`, ctx.s1.t, { text: "my answer" });
    ctx.assignSubId = s.body.submission._id;
    let r = await call("PATCH", `/submissions/${ctx.assignSubId}/grade`, ctx.teacher.t, { score: null, feedback: "note" });
    assert.equal(r.body.submission.status, "submitted");
    r = await call("PATCH", `/submissions/${ctx.assignSubId}/grade`, ctx.teacher.t, { score: 8, feedback: "good" });
    assert.equal(r.body.submission.status, "graded");
    assert.equal(r.body.submission.score, 8);
  });
});

describe("#10 #11 graded work is protected from later edits", () => {
  test("points can't drop below a mark already given", async () => {
    let r = await call("PUT", `/assessments/${ctx.assign._id}`, ctx.teacher.t, { points: 5 });
    assert.equal(r.status, 400);
    r = await call("PUT", `/assessments/${ctx.assign._id}`, ctx.teacher.t, { points: 8 });
    assert.equal(r.status, 200);
  });

  test("a taken quiz keeps its answers; wording can still change", async () => {
    const moved = questions.map((q, i) => (i === 0 ? { ...q, correctIndex: 0 } : q));
    let r = await call("PUT", `/assessments/${ctx.untimed._id}`, ctx.teacher.t, { questions: moved });
    assert.equal(r.status, 400);
    const reworded = questions.map((q, i) => (i === 0 ? { ...q, text: "What is 1 + 1?" } : q));
    r = await call("PUT", `/assessments/${ctx.untimed._id}`, ctx.teacher.t, { questions: reworded });
    assert.equal(r.status, 200);
  });
});

describe("#5 #14 course completion follows visible lessons", () => {
  test("a draft lesson can't be completed", async () => {
    const r = await call("POST", `/enrollments/${ctx.course._id}/complete`, ctx.s1.t, { lessonId: ctx.lessons[2]._id });
    assert.equal(r.status, 404);
  });

  test("completing every visible lesson completes the course", async () => {
    await call("POST", `/enrollments/${ctx.course._id}/complete`, ctx.s1.t, { lessonId: ctx.lessons[0]._id });
    const r = await call("POST", `/enrollments/${ctx.course._id}/complete`, ctx.s1.t, { lessonId: ctx.lessons[1]._id });
    assert.equal(r.body.justCompletedCourse, true);
  });

  test("a new lesson puts the course back in progress", async () => {
    ctx.l4 = await Lesson.create({ course: ctx.course._id, title: "L4", order: 3 });
    const r = await call("GET", "/enrollments/mine", ctx.s1.t);
    assert.equal(r.body.enrollments[0].status, "active");
    assert.equal(r.body.enrollments[0].percent, 67);
  });
});

describe("#13 #6 #19 lessons, notes and progress", () => {
  test("notes only save against a real lesson in the course", async () => {
    let r = await call("PUT", `/enrollments/${ctx.course._id}/notes/not-a-lesson`, ctx.s1.t, { text: "x" });
    assert.equal(r.status, 404);
    r = await call("PUT", `/enrollments/${ctx.course._id}/notes/${ctx.lessons[0]._id}`, ctx.s1.t, { text: "my note" });
    assert.equal(r.status, 200);
  });

  test("deleting a lesson removes it from progress, notes and resume spot", async () => {
    const l1 = ctx.lessons[0]._id;
    await call("POST", `/enrollments/${ctx.course._id}/visit`, ctx.s1.t, { lessonId: l1 });
    await call("DELETE", `/courses/${ctx.course._id}/lessons/${l1}`, ctx.teacher.t);
    const e = await Enrollment.findOne({ student: ctx.s1.u._id }).lean();
    assert.ok(!e.completedLessons.some((id) => String(id) === String(l1)));
    assert.equal((e.notes || {})[String(l1)], undefined);
    assert.equal(e.lastLessonId, null);
  });

  test("teacher pages ignore stale ids and never pass 100%", async () => {
    await Enrollment.updateOne(
      { student: ctx.s1.u._id },
      { $push: { completedLessons: new mongoose.Types.ObjectId() } }
    );
    let r = await call("GET", `/courses/${ctx.course._id}/enrollments`, ctx.teacher.t);
    const row = r.body.enrollments.find((x) => String(x.student._id) === String(ctx.s1.u._id));
    assert.deepEqual([row.completed, row.total, row.percent], [1, 2, 50]);
    r = await call("GET", "/students", ctx.teacher.t);
    const rs = r.body.students.find((x) => String(x.student._id) === String(ctx.s1.u._id));
    assert.equal(rs.courses[0].completed, 1);
    assert.equal(rs.courses[0].status, "active");
  });
});

describe("#9 teacher email is not public", () => {
  test("visitors see the owner's name only; the owner sees the email", async () => {
    let r = await call("GET", `/courses/${ctx.course._id}`);
    assert.equal(r.body.course.owner.name, "Teacher");
    assert.equal(r.body.course.owner.email, undefined);
    r = await call("GET", `/courses/${ctx.course._id}`, ctx.teacher.t);
    assert.equal(r.body.course.owner.email, "teacher@example.test");
  });
});

describe("#7 imported passwords", () => {
  test("are random words, not built from the name", async () => {
    const r = await call("POST", "/users/bulk", ctx.admin.t, {
      people: [{ name: "Asha Patel", email: "asha@example.test" }],
    });
    assert.equal(r.status, 201);
    const pw = r.body.created[0].password;
    assert.match(pw, /^[a-z]+-[a-z]+-\d{3}$/);
    assert.ok(!/asha|patel/i.test(pw));
  });
});

describe("#18 name and email checks", () => {
  test("a bad email or a non-text name is a clear 400, not a crash", async () => {
    let r = await call("POST", "/auth/register", null, { name: "Ravi", email: "not-an-email", password: "goodpass123" });
    assert.equal(r.status, 400);
    r = await call("POST", "/auth/register", null, { name: 12345, email: "ravi@example.test", password: "goodpass123" });
    assert.equal(r.status, 400);
    r = await call("POST", "/users", ctx.admin.t, { name: "X Y", email: "bad", password: "goodpass123", role: "teacher" });
    assert.equal(r.status, 400);
  });
});

describe("#8 deactivating ends sessions for good", () => {
  test("an old token stays dead after the account is reactivated", async () => {
    const id = ctx.s3.u._id;
    assert.equal((await call("GET", "/auth/me", ctx.s3.t)).status, 200);
    await call("PATCH", `/users/${id}/active`, ctx.admin.t, { active: false });
    assert.equal((await call("GET", "/auth/me", ctx.s3.t)).status, 401);
    await call("PATCH", `/users/${id}/active`, ctx.admin.t, { active: true });
    assert.equal((await call("GET", "/auth/me", ctx.s3.t)).status, 401);
  });
});

describe("clean-up on delete", () => {
  test("deleting a course removes its quiz start records", async () => {
    await call("DELETE", `/courses/${ctx.course._id}`, ctx.teacher.t);
    assert.equal(await QuizAttempt.countDocuments({ course: ctx.course._id }), 0);
  });
});
