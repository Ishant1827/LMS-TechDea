const jwt = require("jsonwebtoken");
const User = require("../models/User");

function readToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

// Require a valid token. Populates req.user.
async function protect(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ message: "Please sign in" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user || !user.active) return res.status(401).json({ message: "Account not available" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Your session has expired — sign in again" });
  }
}

// Populate req.user if a valid token is present, but don't reject anonymous requests.
async function optionalAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id);
      if (user && user.active) req.user = user;
    }
  } catch (e) {
    /* ignore — treat as anonymous */
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You don't have access to that" });
    }
    next();
  };
}

module.exports = { protect, optionalAuth, requireRole };
