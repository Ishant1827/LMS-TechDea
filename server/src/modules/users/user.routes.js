const router = require("express").Router();
const c = require("./user.controller");
const { protect, requireRole } = require("../../shared/middleware/auth");
const { adminPasswordLimiter } = require("../../shared/middleware/rateLimit");

router.use(protect, requireRole("admin"));

router.get("/", c.list);
router.post("/", c.create);
router.patch("/:id/role", c.setRole);
router.patch("/:id/password", adminPasswordLimiter, c.setPassword);
router.patch("/:id/active", c.setActive);
router.delete("/:id", c.remove);

module.exports = router;
