const router = require("express").Router();
const c = require("./course.controller");
const rv = require("../reviews/review.controller");
const lessonRoutes = require("../lessons/lesson.routes");
const { protect, optionalAuth, requireRole } = require("../../shared/middleware/auth");

// specific routes before "/:id"
router.get("/", c.listPublished);
router.get("/manage", protect, requireRole("teacher", "admin"), c.listManaged);

router.post("/", protect, requireRole("teacher", "admin"), c.create);
router.get("/:id", optionalAuth, c.getOne);
router.put("/:id", protect, requireRole("teacher", "admin"), c.update);
router.delete("/:id", protect, requireRole("teacher", "admin"), c.remove);
router.patch("/:id/publish", protect, requireRole("teacher", "admin"), c.setPublished);
router.patch("/:id/owner", protect, requireRole("admin"), c.reassignOwner);
router.get("/:id/enrollments", protect, requireRole("teacher", "admin"), c.courseEnrollments);
router.get("/:id/performance", protect, requireRole("teacher", "admin"), c.performance);

// reviews
router.get("/:id/reviews", optionalAuth, rv.list);
router.post("/:id/reviews", protect, rv.upsert);
router.delete("/:id/reviews/mine", protect, rv.removeMine);

// nested: /api/courses/:courseId/lessons/...
router.use("/:courseId/lessons", lessonRoutes);

module.exports = router;
