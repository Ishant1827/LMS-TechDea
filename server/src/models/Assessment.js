const mongoose = require("mongoose");
const { ASSESSMENT_KINDS } = require("../utils/constants");

// One multiple-choice question inside a quiz.
const questionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    options: {
      type: [String],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2 && arr.length <= 6,
        message: "A question needs between 2 and 6 options",
      },
    },
    correctIndex: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

// An assignment or a quiz attached to a course. Draft until `published`,
// mirroring how lessons work.
const assessmentSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    kind: { type: String, enum: ASSESSMENT_KINDS, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    instructions: { type: String, default: "", maxlength: 8000 },
    dueAt: { type: Date, default: null },
    published: { type: Boolean, default: false },

    // assignment — max marks the teacher grades out of
    points: { type: Number, default: 100, min: 1, max: 1000 },

    // quiz
    questions: { type: [questionSchema], default: [] },
    passPercent: { type: Number, default: 60, min: 0, max: 100 },
    timeLimitMin: { type: Number, default: 0, min: 0, max: 600 }, // 0 = untimed

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

assessmentSchema.index({ course: 1, kind: 1 });

module.exports = mongoose.model("Assessment", assessmentSchema);
