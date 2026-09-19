const ROLES = ["student", "teacher", "admin"];
const STAFF_ROLES = ["teacher", "admin"];
const LESSON_TYPES = ["video", "reading", "file"];
const ENROLLMENT_STATUS = ["active", "completed"];
const DIFFICULTY = ["beginner", "intermediate", "advanced"];
const DOUBT_STATUS = ["open", "answered", "resolved"];
const ASSESSMENT_KINDS = ["assignment", "quiz"];
// "returned" = the teacher sent it back for another try. It is the student's
// move again, so it counts as neither waiting-to-be-graded nor finished.
const SUBMISSION_STATUS = ["submitted", "graded", "returned"];

module.exports = {
  ROLES,
  STAFF_ROLES,
  LESSON_TYPES,
  ENROLLMENT_STATUS,
  DIFFICULTY,
  DOUBT_STATUS,
  ASSESSMENT_KINDS,
  SUBMISSION_STATUS,
};
