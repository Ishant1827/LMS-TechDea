const mongoose = require("mongoose");
const { ENROLLMENT_STATUS } = require("../utils/constants");

const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lesson" }],
    // per-lesson private notes: { <lessonId>: "text" }
    notes: { type: Map, of: String, default: {} },
    // "resume where you left off" — last lesson the student opened
    lastLessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null },
    status: { type: String, enum: ENROLLMENT_STATUS, default: "active" },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// one enrollment per student per course
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model("Enrollment", enrollmentSchema);
