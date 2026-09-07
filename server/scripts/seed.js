/* Seed an admin, a sample teacher, and two published sample courses so the
   catalog isn't empty. Safe to run more than once — it won't duplicate. */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Course = require("../src/models/Course");
const Lesson = require("../src/models/Lesson");

async function upsertUser({ email, name, role, password }) {
  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    user = new User({ email: email.toLowerCase(), name, role });
    await user.setPassword(password);
    await user.save();
    console.log(`  created ${role}: ${email}`);
  } else {
    console.log(`  kept existing ${user.role}: ${email}`);
  }
  return user;
}

// [module, title, type, extra] -> lesson doc
function buildLessons(courseId, rows) {
  return rows.map(([module, title, type, extra], i) => ({
    course: courseId,
    module,
    title,
    type,
    order: i,
    durationMin: extra.durationMin || 0,
    videoUrl: extra.videoUrl || "",
    content: extra.content || "",
    fileUrl: extra.fileUrl || "",
    fileName: extra.fileName || "",
  }));
}

(async () => {
  await connectDB();
  console.log("Seeding...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@techdea.local";
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "admin12345";

  const admin = await upsertUser({
    email: adminEmail,
    name: process.env.SEED_ADMIN_NAME || "Admin",
    role: "admin",
    password: adminPass,
  });

  const teacher = await upsertUser({
    email: "teacher@techdea.local",
    name: "Alan Cruz",
    role: "teacher",
    password: "teacher12345",
  });

  if ((await Course.countDocuments()) === 0) {
    const figma = await Course.create({
      title: "Intro to Figma",
      teacherName: "Marcus Lee",
      thumbnailUrl: "https://images.unsplash.com/photo-1587440871875-191322ee64b0?w=800&q=80",
      owner: teacher._id,
      hours: 3,
      published: true,
      description:
        "Get comfortable with frames, components and auto-layout by rebuilding three real interfaces.",
      learn: [
        "Frames, groups and constraints",
        "Components and variants",
        "Auto-layout in practice",
        "Prototyping basics",
      ],
    });
    await Lesson.insertMany(
      buildLessons(figma._id, [
        ["Getting Around Figma", "The canvas and panels", "video", {
          durationMin: 8,
          videoUrl: "https://www.youtube.com/watch?v=FTFaQWZBqQ8",
        }],
        ["Getting Around Figma", "Frames vs groups", "reading", {
          durationMin: 5,
          content:
            "A frame is a container with its own layout rules; a group is just a bounding box around layers.\n\nUse frames for anything that needs constraints, auto-layout, or its own scroll behaviour. Use groups only for quick, throwaway selections you plan to ungroup soon.",
        }],
        ["Components & Auto-layout", "Your first component", "video", {
          durationMin: 11,
          videoUrl: "https://www.youtube.com/watch?v=jkuKq0X0J8M",
        }],
        ["Components & Auto-layout", "Auto-layout basics", "reading", {
          durationMin: 7,
          content:
            "Auto-layout turns a frame into a flex container. Set direction, spacing, and padding, then let children resize the frame instead of positioning them by hand.\n\nTry: select two buttons, press Shift+A, then change the spacing.",
        }],
        ["Prototyping", "Prototyping checklist", "file", {
          durationMin: 3,
          fileName: "prototyping-checklist.pdf",
          fileUrl: "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf",
        }],
      ])
    );

    const speaking = await Course.create({
      title: "Public Speaking Basics",
      teacherName: "Dana Ford",
      thumbnailUrl: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=80",
      owner: teacher._id,
      hours: 2,
      published: true,
      description:
        "Structure a talk, manage nerves, and hold a room — practised in short recorded exercises.",
      learn: ["Structuring a talk", "Vocal delivery", "Handling nerves", "Q&A technique"],
    });
    await Lesson.insertMany(
      buildLessons(speaking._id, [
        ["Structure", "Opening strong", "video", {
          durationMin: 6,
          videoUrl: "https://www.youtube.com/watch?v=8S0FDjFBj8o",
        }],
        ["Structure", "The three-point body", "reading", {
          durationMin: 5,
          content:
            "Pick exactly three points. More than that and the audience won't remember any of them.\n\nFor each point: claim, one piece of evidence, one story. Then transition with a full stop and a breath.",
        }],
        ["Delivery", "Pace and pauses", "reading", {
          durationMin: 4,
          content:
            "Silence feels long on stage and short in the room. Pause after every key sentence — count to two before moving on.",
        }],
        ["Delivery", "Using your hands", "reading", {
          durationMin: 4,
          content:
            "Rest position: hands loosely together at your waist. Gesture inside a box from shoulder to shoulder, elbows off your ribs.",
        }],
      ])
    );

    console.log("  seeded 2 sample courses (video / reading / file lessons)");
  } else {
    console.log("  courses already exist — skipped sample courses");
  }

  console.log("\nDone. Sign in with:");
  console.log(`  admin    ${adminEmail}  /  ${adminPass}`);
  console.log("  teacher  teacher@techdea.local  /  teacher12345");

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
