// The one ownership rule for course content: an admin manages every course, a
// teacher only the ones they own. Every controller that edits, grades or reads
// staff-only data for a course asks this — never the role alone.
const canManage = (user, course) =>
  user.role === "admin" || String(course.owner) === String(user._id);

module.exports = { canManage };
