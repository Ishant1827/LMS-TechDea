const mongoose = require("mongoose");
const { ASSESSMENT_KINDS, SUBMISSION_STATUS } = require("../../shared/utils/constants");

// A student's attempt at one assessment. One per (assessment, student).
const submissionSchema = new mongoose.Schema(
  {
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ASSESSMENT_KINDS, required: true }, // denormalised for querying

    // assignment
    text: { type: String, default: "", maxlength: 20000 },
    link: { type: String, default: "", maxlength: 2000 },

    // quiz — selected option index per question (-1 = skipped)
    answers: { type: [Number], default: [] },
    autoScore: { type: Number, default: null }, // percentage from auto-grading

    // grading — `score` is on the points scale for an assignment, a percentage for a quiz
    score: { type: Number, default: null },
    feedback: { type: String, default: "", maxlength: 8000 },
    status: { type: String, enum: SUBMISSION_STATUS, default: "submitted" },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    gradedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

submissionSchema.index({ assessment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Submission", submissionSchema);
