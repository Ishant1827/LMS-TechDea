import { ClipboardList } from "lucide-react";
import ComingSoon from "../components/ComingSoon";

export default function StudentAssignments() {
  return (
    <ComingSoon
      title="Assignments & Quizzes"
      icon={ClipboardList}
      blurb="Your assignments and quizzes from every course you're enrolled in will live here."
      points={[
        "See what's due and what's been graded",
        "Submit assignment files",
        "Take timed quizzes and view your score + feedback",
      ]}
    />
  );
}
