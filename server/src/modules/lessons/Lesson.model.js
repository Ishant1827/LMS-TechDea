const mongoose = require("mongoose");
const { LESSON_TYPES } = require("../../shared/utils/constants");

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    // Module grouping — a free-text label; lessons with the same label render together.
    module: { type: String, default: "Introduction", trim: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },

    type: { type: String, enum: LESSON_TYPES, default: "reading" },
    durationMin: { type: Number, default: 0, min: 0 },
    // draft lessons are hidden from students until published
    published: { type: Boolean, default: true },

    // video: an embed/watch URL (YouTube/Vimeo/…). Never uploaded here.
    videoUrl: { type: String, default: "" },
    // reading: the lesson text
    content: { type: String, default: "" },
    // file: a link to a downloadable resource + its display name
    fileUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
  },
  { timestamps: true }
);

lessonSchema.index({ course: 1, order: 1 });

module.exports = mongoose.model("Lesson", lessonSchema);
