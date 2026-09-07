// Mounted at /api/courses/:courseId/lessons
const router = require("express").Router({ mergeParams: true });
const c = require("../controllers/lessonController");
const { protect, optionalAuth, requireRole } = require("../middleware/auth");

router.get("/", optionalAuth, c.list);

router.post("/", protect, requireRole("teacher", "admin"), c.create);
router.put("/reorder", protect, requireRole("teacher", "admin"), c.reorder); // before /:lessonId
router.put("/:lessonId", protect, requireRole("teacher", "admin"), c.update);
router.delete("/:lessonId", protect, requireRole("teacher", "admin"), c.remove);

module.exports = router;
