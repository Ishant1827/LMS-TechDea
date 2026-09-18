// One greppable line per failure. Deliberately not a logging library — the rest
// of the server logs with plain console, and Render's log view is just text.

const line = (err, req, status) => {
  const where = req ? `${req.method} ${req.originalUrl}` : "process";
  const who = req?.user?._id ? ` user=${req.user._id}` : "";
  const ref = req?.id ? ` ${req.id}` : "";
  return `[error]${ref} ${where} ${status}${who} — ${err.message}`;
};

// Log a request-scoped failure. Stacks are noisy, so they are kept for the 5xx
// case — a 400 from a missing title is not something anyone will debug.
function logError(err, req, status = err.status || 500) {
  if (process.env.NODE_ENV === "test") return;
  console.error(line(err, req, status));
  if (status >= 500 && err.stack) console.error(err.stack);
}

// Same shape for failures that never belonged to a request.
function logFatal(label, err) {
  console.error(`[fatal] ${label} — ${err?.message || err}`);
  if (err?.stack) console.error(err.stack);
}

module.exports = { logError, logFatal };
