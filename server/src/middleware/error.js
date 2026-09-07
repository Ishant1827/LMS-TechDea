function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (process.env.NODE_ENV !== "test") console.error(err);

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: Object.values(err.errors).map((e) => e.message).join(", "),
    });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Bad id in request" });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "That value is already taken" });
  }
  res.status(err.status || 500).json({ message: err.message || "Server error" });
}

module.exports = { notFound, errorHandler };
