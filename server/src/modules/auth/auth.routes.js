const router = require("express").Router();
const c = require("./auth.controller");
const { protect } = require("../../shared/middleware/auth");
const {
  loginLimiter,
  registerLimiter,
  passwordLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  passwordResetLimiter,
  emailChangeLimiter,
  emailVerifyLimiter,
} = require("../../shared/middleware/rateLimit");

router.post("/register", registerLimiter, c.register);
router.post("/login", loginLimiter, c.login);

// Public by design — a code has to be usable by someone who is not signed in.
// R8: both are authentication-adjacent, so both are limited.
router.post("/otp/request", otpRequestLimiter, c.otpRequest);
router.post("/otp/verify", otpVerifyLimiter, c.otpVerify);
router.post("/password/reset", passwordResetLimiter, c.resetPassword);
router.get("/me", protect, c.me);
router.put("/me", protect, c.updateMe);
router.put("/me/password", protect, passwordLimiter, c.changePassword);

// The address change is its own flow, not a field on PUT /me — see the
// controller for why.
router.put("/me/email", protect, emailChangeLimiter, c.requestEmailChange);
router.post("/me/email/verify", protect, emailVerifyLimiter, c.verifyEmailChange);
router.delete("/me/email", protect, c.cancelEmailChange);

module.exports = router;
