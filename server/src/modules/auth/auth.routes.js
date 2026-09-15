const router = require("express").Router();
const c = require("./auth.controller");
const { protect } = require("../../shared/middleware/auth");
const { loginLimiter, registerLimiter, passwordLimiter } = require("../../shared/middleware/rateLimit");

router.post("/register", registerLimiter, c.register);
router.post("/login", loginLimiter, c.login);
router.get("/me", protect, c.me);
router.put("/me", protect, c.updateMe);
router.put("/me/password", protect, passwordLimiter, c.changePassword);

module.exports = router;
