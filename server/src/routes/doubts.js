const router = require("express").Router();
const c = require("../controllers/doubtController");
const { protect, requireRole } = require("../middleware/auth");

router.use(protect);

router.get("/mine", c.mine);
router.post("/", c.create);

router.get("/teaching", requireRole("teacher", "admin"), c.teaching);
router.patch("/:id", requireRole("teacher", "admin"), c.answer);

module.exports = router;
