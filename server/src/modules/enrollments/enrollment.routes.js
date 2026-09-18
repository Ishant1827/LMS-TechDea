const router = require("express").Router();
const c = require("./enrollment.controller");
const { protect, requireRole } = require("../../shared/middleware/auth");

router.use(protect);

router.get("/all", requireRole("admin"), c.all); // before "/:courseId" style routes
router.get("/mine", c.mine);
router.post("/", c.enroll);
router.delete("/:courseId", c.unenroll);
router.get("/:courseId/notes", c.getNotes);
router.put("/:courseId/notes/:lessonId", c.saveNote);
router.post("/:courseId/visit", c.visit);
router.post("/:courseId/complete", c.completeLesson);

module.exports = router;
