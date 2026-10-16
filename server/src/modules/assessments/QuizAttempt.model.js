const mongoose = require("mongoose");

// When a student started a timed quiz. One per (assessment, student).
//
// The countdown used to live only in the browser, so a refresh restarted it at
// the full limit and the server accepted answers however late they came. This
// row is the clock the server trusts: the page counts down from it after a
// refresh, and a submission past it is refused.
//
// Kept apart from Submission on purpose — a started quiz is not handed-in work,
// and every count of submissions would otherwise have to learn to skip it.
const quizAttemptSchema = new mongoose.Schema({
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  startedAt: { type: Date, required: true },
});

quizAttemptSchema.index({ assessment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
