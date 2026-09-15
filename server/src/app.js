const express = require("express");
const cors = require("cors");
const { notFound, errorHandler } = require("./shared/middleware/error");

const app = express();

// Render terminates TLS at its proxy; without this req.ip is the proxy's
// address and every user looks like one client to the rate limiters.
app.set("trust proxy", 1);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: "3mb" })); // room for base64 course thumbnails

app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", require("./modules/auth/auth.routes"));
app.use("/api/courses", require("./modules/courses/course.routes"));
app.use("/api/enrollments", require("./modules/enrollments/enrollment.routes"));
app.use("/api/doubts", require("./modules/doubts/doubt.routes"));
app.use("/api/assessments", require("./modules/assessments/assessment.routes"));
app.use("/api/submissions", require("./modules/submissions/submission.routes"));
app.use("/api/students", require("./modules/students/student.routes"));
app.use("/api/users", require("./modules/users/user.routes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
