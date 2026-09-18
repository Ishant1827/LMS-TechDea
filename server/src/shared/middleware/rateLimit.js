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

// Asking for a code is an unauthenticated request that causes us to send an
// email, which makes it an amplifier: free to trigger, costly to absorb, and
// aimed at somebody else's inbox. The per-address cooldown lives in the OtpToken
// document (M13) because it has to survive a restart; this is the address-level
// cap, keyed on IP *and* email for the same reason as sign-in (D6).
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  keyGenerator: perIpAndEmail,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many code requests. Try again in about 15 minutes."),
});

// Guessing is capped at five attempts per code inside the token document, and
// that is the control that matters — this only stops someone cycling fresh codes
// to farm attempts, and keeps the endpoint from being a free database read.
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: perIpAndEmail,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many attempts. Try again in about 15 minutes."),
});

// The action token is 32 random bytes and single use, so this is not really
// guessable — but the endpoint writes a password hash, and an unauthenticated
// endpoint that does bcrypt work is a cheap way to burn our CPU.
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: perIpAndEmail,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many attempts. Try again in about 15 minutes."),
});

// Changing an address sends mail to an address the *requester* chose, which
// makes it the one authenticated endpoint that can be pointed at a stranger's
// inbox. Keyed on the account rather than the body, because the body is the
// part being aimed.
const emailChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => String(req.user?._id || ipKeyGenerator(req.ip)),
  // Only requests that actually sent something count. A rejected one — wrong
  // password, malformed address, already in use — aimed no mail anywhere, and
  // charging for it would lock someone out of changing their own address for an
  // hour over five typos. The budget is "how many inboxes may you aim at", not
  // "how many times may you try".
  skipFailedRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many email change requests. Try again later."),
});

// Confirming an email change carries only the code — there is no address in the
// body for perIpAndEmail to key on, which would collapse every user behind one
// campus NAT into a single bucket (exactly the D6 failure). The account is
// known here, so key on that. The five-attempt cap inside the token document
// remains the real control.
const emailVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => String(req.user?._id || ipKeyGenerator(req.ip)),
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: message("Too many attempts. Try again in about 15 minutes."),
});

module.exports = {
  loginLimiter,
  registerLimiter,
  passwordLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  passwordResetLimiter,
  emailChangeLimiter,
  emailVerifyLimiter,
};
