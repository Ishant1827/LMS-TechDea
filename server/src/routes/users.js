const router = require("express").Router();
const c = require("../controllers/userController");
const { protect, requireRole } = require("../middleware/auth");

router.use(protect, requireRole("admin"));

router.get("/", c.list);
router.post("/", c.create);
router.patch("/:id/role", c.setRole);
router.patch("/:id/active", c.setActive);
router.delete("/:id", c.remove);

module.exports = router;
