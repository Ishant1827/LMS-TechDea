const router = require("express").Router();
const c = require("./submission.controller");
const { protect, requireRole } = require("../../shared/middleware/auth");

router.use(protect, requireRole("teacher", "admin"));

router.get("/pending", c.pending);
router.patch("/:id/grade", c.grade);
router.patch("/:id/return", c.returnForRevision);

module.exports = router;
