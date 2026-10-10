const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const requestId = require("./shared/middleware/requestId");
const { notFound, errorHandler } = require("./shared/middleware/error");

const app = express();

// First in the stack, so even a request rejected by CORS or the body parser
// carries an id that ties the response to a log line.
app.use(requestId);

// Render terminates TLS at its proxy; without this req.ip is the proxy's
// address and every user looks like one client to the rate limiters.
app.set("trust proxy", 1);

// Security headers (G1): nosniff, HSTS, frame-ancestors and a default-deny CSP.
// The API only ever returns JSON, so the strict defaults cost nothing here. The
// CSP that protects the *app* is set on the static site — see render.yaml.
app.use(helmet());

// Fails closed (G11). With CLIENT_ORIGIN unset no other origin is allowed, rather
// than every origin being reflected back. Local development is unaffected: the
// Vite proxy makes the client and the API the same origin.
if (!process.env.CLIENT_ORIGIN) {
  console.warn("CLIENT_ORIGIN is not set — cross-origin requests will be refused.");
}
app.use(cors({ origin: process.env.CLIENT_ORIGIN || false, credentials: true }));
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
