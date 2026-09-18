/* Seed an admin, a sample teacher, and two published sample courses so the
   catalog isn't empty. Safe to run more than once — it won't duplicate. */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/modules/users/User.model");
const Course = require("../src/modules/courses/Course.model");
const Lesson = require("../src/modules/lessons/Lesson.model");
const Assessment = require("../src/modules/assessments/Assessment.model");

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

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@techdea.in";
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "admin12345";

  // The demo teacher's address follows the admin's domain, so seeded accounts
  // do not sit on a reserved TLD that can never receive mail. It is still a
  // placeholder — a real teacher should be created from Admin > Users with an
  // address they actually read.
  const teacherEmail =
    process.env.SEED_TEACHER_EMAIL ||
    `teacher@${adminEmail.split("@")[1] || "techdea.in"}`;
  const teacherPass = process.env.SEED_TEACHER_PASSWORD || "teacher12345";

  const admin = await upsertUser({
    email: adminEmail,
    name: process.env.SEED_ADMIN_NAME || "Admin",
    role: "admin",
    password: adminPass,
  });

  const teacher = await upsertUser({
    email: teacherEmail,
    name: "Alan Cruz",
    role: "teacher",
    password: teacherPass,
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

  // Assessments — idempotent, so this also back-fills an already-seeded DB.
  if ((await Assessment.countDocuments()) === 0) {
    const inDays = (n) => new Date(Date.now() + n * 86400000);
    const figma = await Course.findOne({ title: "Intro to Figma" });
    const speaking = await Course.findOne({ title: "Public Speaking Basics" });
    const rows = [];
    if (figma)
      rows.push(
      {
        course: figma._id,
        kind: "assignment",
        title: "Rebuild a login screen",
        instructions:
          "Recreate the login screen from lesson 3 using components and auto-layout.\n\n" +
          "Share a link to your Figma file (set link-sharing to 'anyone with the link') and " +
          "note anything you found tricky.",
        points: 100,
        dueAt: inDays(7),
        published: true,
        createdBy: teacher._id,
      },
      {
        course: figma._id,
        kind: "quiz",
        title: "Frames & auto-layout check",
        instructions: "A quick 3-question check on the first module. 60% to pass.",
        passPercent: 60,
        timeLimitMin: 5,
        published: true,
        createdBy: teacher._id,
        questions: [
          {
            text: "What makes a frame different from a group?",
            options: [
              "Nothing — they're the same",
              "A frame can have its own layout rules and constraints",
              "A group can be exported but a frame can't",
            ],
            correctIndex: 1,
          },
          {
            text: "Auto-layout turns a frame into…",
            options: ["A flex container", "A vector network", "A component set"],
            correctIndex: 0,
          },
          {
            text: "Which shortcut adds auto-layout to a selection?",
            options: ["Shift + A", "Ctrl + G", "Alt + L"],
            correctIndex: 0,
          },
        ],
      }
      );
    if (speaking)
      rows.push({
        course: speaking._id,
        kind: "quiz",
        title: "Structure basics",
        instructions: "Two questions on structuring a talk.",
        passPercent: 50,
        published: true,
        createdBy: teacher._id,
        questions: [
          {
            text: "How many main points should a short talk have?",
            options: ["As many as fit", "Exactly three", "One"],
            correctIndex: 1,
          },
          {
            text: "What belongs in each point?",
            options: ["Claim, evidence, story", "Only a claim", "A slide and a joke"],
            correctIndex: 0,
          },
        ],
      });

    if (rows.length) {
      await Assessment.create(rows);
      console.log(`  seeded ${rows.length} assessments (assignment + quizzes)`);
    } else {
      console.log("  no matching sample courses — skipped assessments");
    }
  } else {
    console.log("  assessments already exist — skipped");
  }

  console.log("\nDone. Sign in with:");
  console.log(`  admin    ${adminEmail}  /  ${adminPass}`);
  console.log(`  teacher  ${teacherEmail}  /  ${teacherPass}`);

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
