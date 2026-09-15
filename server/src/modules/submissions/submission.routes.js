const router = require("express").Router();
const c = require("./submission.controller");
const { protect, requireRole } = require("../../shared/middleware/auth");

router.use(protect, requireRole("teacher", "admin"));

router.patch("/:id/grade", c.grade);

module.exports = router;
