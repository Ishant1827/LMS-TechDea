const express = require("express");
const cors = require("cors");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: "3mb" })); // room for base64 course thumbnails

app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/courses", require("./routes/courses"));
app.use("/api/enrollments", require("./routes/enrollments"));
app.use("/api/doubts", require("./routes/doubts"));
app.use("/api/assessments", require("./routes/assessments"));
app.use("/api/submissions", require("./routes/submissions"));
app.use("/api/students", require("./routes/students"));
app.use("/api/users", require("./routes/users"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
