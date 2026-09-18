const router = require("express").Router();
const c = require("./doubt.controller");
const { protect, requireRole, requireVerified } = require("../../shared/middleware/auth");

router.use(protect);

router.get("/mine", c.mine);
router.post("/", requireVerified, c.create);

router.get("/teaching", requireRole("teacher", "admin"), c.teaching);
router.patch("/:id", requireRole("teacher", "admin"), c.answer);

module.exports = router;
