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

// The same account from anywhere. The limiter above is per IP, so someone
// rotating addresses could keep guessing one account; this caps the total.
// Generous, because it also locks out the real owner while it is in force.
const loginAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `acct:${String(req.body?.email || "").toLowerCase().trim()}`,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many sign-in attempts for this account. Try again in an hour, or ask an admin."),
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

// Admin-only, but it writes a password hash and can take over any account, so
// it gets a ceiling like every other credential-writing path (R8). Keyed on the
// admin doing it.
const adminPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => String(req.user?._id || ipKeyGenerator(req.ip)),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many password resets. Try again in about 15 minutes."),
});

// A bulk import creates accounts and burns CPU on bcrypt — about 150ms per
// person — so it is the one admin endpoint that could flatten a small instance
// by accident as easily as on purpose. The per-request cap in the controller
// bounds one call; this bounds how many calls. 30 x 50 is 1500 accounts in a
// quarter of an hour, which is far beyond any real import.
const bulkImportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => String(req.user?._id || ipKeyGenerator(req.ip)),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many imports at once. Try again in about 15 minutes."),
});

// Acting on many accounts at once is admin-only and cheap per row, but it is
// also the most destructive button in the product. A ceiling costs nothing and
// bounds a mistake made in a loop.
const bulkActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => String(req.user?._id || ipKeyGenerator(req.ip)),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many bulk actions. Try again in about 15 minutes."),
});

module.exports = {
  loginLimiter,
  loginAccountLimiter,
  registerLimiter,
  passwordLimiter,
  adminPasswordLimiter,
  bulkImportLimiter,
  bulkActionLimiter,
};
