// One 0..100 figure for a graded submission. A quiz score is already a
// percentage; an assignment score is out of the assessment's `points`. `null`
// means not scored yet.
function percentOf(sub, a) {
  if (!sub || sub.score == null) return null;
  if (a.kind === "quiz") return Math.round(sub.score);
  const max = a.points || 100;
  return max ? Math.round((sub.score / max) * 100) : 0;
}

// The client-facing submission object — the same fields wherever a submission
// is returned (taking, grading, sending back), so they cannot drift apart.
function shapeSubmission(sub, a) {
  if (!sub) return null;
  const percent = percentOf(sub, a);
  return {
    _id: sub._id,
    status: sub.status,
    text: sub.text || "",
    link: sub.link || "",
    answers: sub.answers || [],
    autoScore: sub.autoScore,
    score: sub.score,
    percent,
    passed: percent == null ? null : percent >= (a.passPercent || 0),
    feedback: sub.feedback || "",
    submittedAt: sub.submittedAt,
    gradedAt: sub.gradedAt,
    returnedAt: sub.returnedAt,
    student: sub.student, // populated where relevant
  };
}

module.exports = { shapeSubmission, percentOf };
