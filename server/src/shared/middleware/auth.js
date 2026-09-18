const jwt = require("jsonwebtoken");
const User = require("../../modules/users/User.model");
const { mailEnabled } = require("../mail/config");

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

    // Issued before the account's sessions were last invalidated — a password
    // change or reset has happened since. Treated exactly like an expired
    // token, because from the holder's point of view that is what it is.
    //
    // A token minted before this field existed has no `tv`; those are read as
    // version 0, which is what every existing account already has.
    if ((payload.tv ?? 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ message: "Your session has ended — sign in again" });
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

// The enforcement half of the soft gate. The client also hides these actions,
// but that is decoration — R1: the client's checks are UX, the rule lives here.
//
// 403 with a distinguishable code, not 401: the session is perfectly valid, and
// signing out and back in would not help. The client keys its prompt off `code`
// rather than matching on the message text.
function requireVerified(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Please sign in" });

  // No mail configured means no code can be sent, so asking for one would be a
  // demand nobody can satisfy — every new student would be told to confirm an
  // address using a message that will never arrive. The gate stands down with
  // the channel it depends on.
  if (!mailEnabled()) return next();

  // Staff accounts are created by an admin, not self-registered, so there is no
  // signup flow in which they could have verified. Gating them would lock a
  // teacher out of their own course over a check aimed at roster hygiene.
  if (req.user.role !== "student") return next();

  if (!req.user.emailVerifiedAt) {
    return res.status(403).json({
      code: "EMAIL_NOT_VERIFIED",
      message: "Confirm your email address first — we sent you a code.",
    });
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

module.exports = { protect, optionalAuth, requireRole, requireVerified };
