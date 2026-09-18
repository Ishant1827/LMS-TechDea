const jwt = require("jsonwebtoken");
const User = require("../../modules/users/User.model");

function readToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

// The only things an account may do while it is still carrying a password
// somebody else chose. Deliberately tiny, and an allowlist rather than a
// blocklist: anything added to the API later is refused until it is considered.
const DURING_FORCED_CHANGE = new Set([
  "GET /api/auth/me",
  "PUT /api/auth/me/password",
]);

const wayThrough = (req) =>
  DURING_FORCED_CHANGE.has(`${req.method} ${req.originalUrl.split("?")[0].replace(/\/+$/, "")}`);

// Require a valid token. Populates req.user.
async function protect(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ message: "Please sign in" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user || !user.active) return res.status(401).json({ message: "Account not available" });

    // Issued before the account's sessions were last invalidated — a password
    // change or reset has happened since. Treated exactly like an expired
    // token, because from the holder's point of view that is what it is.
    //
    // A token minted before this field existed has no `tv`; those are read as
    // version 0, which is what every existing account already has.
    if ((payload.tv ?? 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ message: "Your session has ended — sign in again" });
    }

    // A password chosen by an admin is not yet a password only this person
    // knows, so the account is held here until they replace it. 403 with a code
    // the client can branch on, not 401: the session is perfectly valid and
    // signing out would not help.
    if (user.mustChangePassword && !wayThrough(req)) {
      return res.status(403).json({
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Choose your own password before you carry on.",
      });
    }

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
      // Same check as protect. A revoked token must not quietly grant the
      // signed-in view of a public page either.
      if (user && user.active && (payload.tv ?? 0) === (user.tokenVersion || 0)) req.user = user;
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
