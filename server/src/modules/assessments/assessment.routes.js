const router = require("express").Router();
const c = require("./assessment.controller");
const { protect, requireRole } = require("../../shared/middleware/auth");

router.use(protect);

// student — assessments across every course I'm enrolled in
router.get("/mine", c.mine);

// manager — assessments for one course  (?courseId=...)
router.get("/", requireRole("teacher", "admin"), c.listForCourse);
router.post("/", requireRole("teacher", "admin"), c.create);

router.get("/:id", c.getOne);
router.put("/:id", requireRole("teacher", "admin"), c.update);
router.delete("/:id", requireRole("teacher", "admin"), c.remove);
router.patch("/:id/publish", requireRole("teacher", "admin"), c.setPublished);

router.post("/:id/start", c.start);
router.post("/:id/submit", c.submit);
router.get("/:id/submissions", requireRole("teacher", "admin"), c.submissions);

module.exports = router;
