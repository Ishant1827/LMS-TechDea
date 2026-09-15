const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// A whole college often shares one NAT address, so a plain per-IP limit on
// sign-in would lock out an entire cohort the moment one of them fat-fingers a
// password. Key the sign-in limiter on IP *and* the email being tried: that
// still stops someone grinding one account, without punishing the room.
const perIpAndEmail = (req, res) => {
  const email = String(req.body?.email || "").toLowerCase().trim();
  return `${ipKeyGenerator(req.ip)}:${email}`;
};

const message = (text) => (req, res) => res.status(429).json({ message: text });

// 8 wrong passwords for one account from one place per 15 minutes.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  keyGenerator: perIpAndEmail,
  skipSuccessfulRequests: true, // only failed sign-ins count toward the limit
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many sign-in attempts. Try again in about 15 minutes."),
});

// Signup is cheap to automate and each one writes a user row.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many accounts created from here. Try again later."),
});

// Changing a password requires the current one — that's a guessable secret too,
// and here the attacker already holds a valid token, so keep it tight.
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.user?._id || ipKeyGenerator(req.ip)),
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many attempts. Try again in about 15 minutes."),
});

module.exports = { loginLimiter, registerLimiter, passwordLimiter };
