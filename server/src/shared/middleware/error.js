const { logError } = require("../utils/logger");

const GENERIC = "Something went wrong on our end.";

function notFound(req, res) {
  // The path is logged but not echoed back — no reflecting request input into
  // the response, and no confirming which routes exist to someone probing.
  if (process.env.NODE_ENV !== "test") {
    console.warn(`[404] ${req.id || "-"} ${req.method} ${req.originalUrl}`);
  }
  res.status(404).json({ message: "Route not found" });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // ── expected failures: the message is already written for a human and is
  // safe to show. Keep these shapes; CastError -> 400 in particular is what
  // turns an injected `{ $ne: null }` into a rejection rather than a match.
  if (err.name === "ValidationError") {
    logError(err, req, 400);
    return res.status(400).json({
      message: Object.values(err.errors).map((e) => e.message).join(", "),
    });
  }
  if (err.name === "CastError") {
    logError(err, req, 400);
    return res.status(400).json({ message: "Bad id in request" });
  }
  if (err.code === 11000) {
    logError(err, req, 409);
    return res.status(409).json({ message: "That value is already taken" });
  }

  // ── body-parser rejects before any route runs. Both are ordinary user
  // mistakes (an oversized course thumbnail, a truncated request) and used to
  // fall through to the 500 branch carrying internal wording.
  if (err.type === "entity.too.large") {
    logError(err, req, 413);
    return res.status(413).json({ message: "That file is too large — keep uploads under 3 MB." });
  }
  if (err.type === "entity.parse.failed") {
    logError(err, req, 400);
    return res.status(400).json({ message: "Malformed request." });
  }

  // ── anything else. A status below 500 means we set it deliberately, so the
  // message is ours and can be shown. Everything else is unplanned: log it in
  // full, but hand the client only the request id to quote back.
  const status = err.status || 500;
  logError(err, req, status);

  if (status < 500) return res.status(status).json({ message: err.message });
  res.status(status).json({ message: GENERIC, ref: req.id });
}

module.exports = { notFound, errorHandler };
