const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: "", trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

// one review per student per course
reviewSchema.index({ course: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
