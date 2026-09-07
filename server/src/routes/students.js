const router = require("express").Router();
const c = require("../controllers/studentController");
const { protect, requireRole } = require("../middleware/auth");

router.use(protect, requireRole("teacher", "admin"));
router.get("/", c.roster);

module.exports = router;
