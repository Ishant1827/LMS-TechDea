import { Link } from "react-router-dom";
import { GraduationCap, PlayCircle, BadgeCheck, MessagesSquare } from "lucide-react";

function Brand({ className }) {
  return (
    <Link to="/login" className={"brand " + (className || "")}>
      <span className="brand-mark">
        <GraduationCap />
      </span>
      <span className="brand-word">
        Tech<span>Dea</span>
      </span>
    </Link>
  );
}

// Split-screen shell for the login / register pages. On phones the hero panel
// collapses and a compact logo sits above the form card.
export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <aside className="auth-hero">
        <Brand />
        <div className="auth-hero-body">
          <h1>Learn it. Build it. Prove it.</h1>
          <p>
            Structured courses with video, reading and downloadable material —
            track every lesson and pick up exactly where you left off.
          </p>
          <ul className="auth-hero-list">
            <li>
              <PlayCircle />
              Video, reading &amp; file lessons in one place
            </li>
            <li>
              <BadgeCheck />
              Progress that resumes where you stopped
            </li>
            <li>
              <MessagesSquare />
              Ask doubts and get answers from your teacher
            </li>
          </ul>
        </div>
        <div className="auth-hero-foot">© {new Date().getFullYear()} TechDea</div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <Brand className="auth-card-brand" />
          {children}
        </div>
      </main>
    </div>
  );
}
