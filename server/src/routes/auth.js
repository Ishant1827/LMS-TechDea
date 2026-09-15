const router = require("express").Router();
const c = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { loginLimiter, registerLimiter, passwordLimiter } = require("../middleware/rateLimit");

router.post("/register", registerLimiter, c.register);
router.post("/login", loginLimiter, c.login);
router.get("/me", protect, c.me);
router.put("/me", protect, c.updateMe);
router.put("/me/password", protect, passwordLimiter, c.changePassword);

module.exports = router;
