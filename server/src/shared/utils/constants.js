const ROLES = ["student", "teacher", "admin"];
const STAFF_ROLES = ["teacher", "admin"];
const LESSON_TYPES = ["video", "reading", "file"];
const ENROLLMENT_STATUS = ["active", "completed"];
const DIFFICULTY = ["beginner", "intermediate", "advanced"];
const DOUBT_STATUS = ["open", "answered", "resolved"];
const ASSESSMENT_KINDS = ["assignment", "quiz"];
const SUBMISSION_STATUS = ["submitted", "graded"];

// Every outbound message declares one of these (R15). The split matters: a
// transactional category is part of operating the account and ignores the user's
// notification preferences, while everything else must honour them and carry an
// unsubscribe path. Getting this wrong in either direction is a problem — a
// missed password reset, or an unsolicited marketing email.
const MAIL_CATEGORIES = [
  "security",
  "account",
  "billing",
  "enrollment",
  "coursework",
  "doubts",
  "announcements",
  "digest",
  "marketing",
];

const TRANSACTIONAL_CATEGORIES = ["security", "account", "billing"];

// The purpose a one-time code is issued for. A code minted to verify a signup
// must never be spendable on a password reset, so this is bound at issue and
// required again at verify.
const OTP_PURPOSES = ["email_verify", "password_reset", "email_change"];

module.exports = {
  ROLES,
  STAFF_ROLES,
  LESSON_TYPES,
  ENROLLMENT_STATUS,
  DIFFICULTY,
  DOUBT_STATUS,
  ASSESSMENT_KINDS,
  SUBMISSION_STATUS,
  MAIL_CATEGORIES,
  TRANSACTIONAL_CATEGORIES,
  OTP_PURPOSES,
};
