const mongoose = require("mongoose");
const { DIFFICULTY } = require("../utils/constants");

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, default: "", trim: true },
    difficulty: { type: String, enum: ["", ...DIFFICULTY], default: "" },
    prerequisites: { type: [String], default: [] },
    // Display label shown to students, e.g. "Alan Cruz". Separate from `owner`
    // so a course can credit a name that isn't the account that manages it.
    teacherName: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    learn: { type: [String], default: [] }, // "what you'll learn" bullets
    hours: { type: Number, default: 0 },
    thumbnailUrl: { type: String, default: "" }, // cover image (a URL, not uploaded here)
    published: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
