import { ClipboardList } from "lucide-react";
import ComingSoon from "../components/ComingSoon";

export default function TeacherAssignments() {
  return (
    <ComingSoon
      title="Assignments & Quizzes"
      icon={ClipboardList}
      blurb="Build assignments and quizzes for your courses, then grade what comes in."
      points={[
        "Assignment builder — instructions, attachment, due date, points",
        "Quiz builder — question bank, pass mark, attempts",
        "Submissions inbox: score and leave written feedback",
        "Gradebook per course",
      ]}
    />
  );
}
