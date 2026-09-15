const router = require("express").Router();
const c = require("./student.controller");
const { protect, requireRole } = require("../../shared/middleware/auth");

router.use(protect, requireRole("teacher", "admin"));
router.get("/", c.roster);

module.exports = router;
