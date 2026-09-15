const mongoose = require("mongoose");
const { DOUBT_STATUS } = require("../../shared/utils/constants");

const doubtSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: DOUBT_STATUS, default: "open" },
    answer: { type: String, default: "" },
    answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    answeredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Doubt", doubtSchema);
