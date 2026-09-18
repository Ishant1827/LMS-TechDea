import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Compass,
  BookOpen,
  Menu,
  Users,
  ClipboardList,
  TrendingUp,
  MessageCircleQuestion,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import AccountMenu from "@/shared/components/layout/AccountMenu";
import Brand from "@/shared/components/layout/Brand";
import { initials, cap } from "@/shared/lib/format";
import { roleHome } from "@/shared/lib/roles";

// [heading, [[path, label, Icon, end?], …]]  — a null heading is the ungrouped
// lead section. Grouping stops six or seven equal-weight links reading as one
// undifferentiated list. Profile is reached from the top-right avatar, not here.
const STUDENT_NAV = [
  [null, [["/", "Dashboard", LayoutDashboard, true]]],
  [
    "Learn",
    [
      ["/courses", "Browse Courses", Compass, false],
      ["/my-learning", "My Learning", BookOpen, false],
      ["/assignments", "Assignments & Quizzes", ClipboardList, false],
    ],
  ],
  [
    "Track",
    [
      ["/progress", "Progress", TrendingUp, false],
      ["/doubts", "Doubts", MessageCircleQuestion, false],
    ],
  ],
];

const TEACHER_NAV = [
  [null, [["/teach", "Dashboard", LayoutDashboard, true]]],
  [
    "Teach",
    [
      ["/manage", "Courses", BookOpen, false],
      ["/teach/assignments", "Assignments & Quizzes", ClipboardList, false],
    ],
  ],
  [
    "People",
    [
      ["/teach/students", "Students", Users, false],
      ["/teach/doubts", "Doubts", MessageCircleQuestion, false],
    ],
  ],
  ["Insights", [["/teach/performance", "Performance", BarChart3, false]]],
];

// Admin = teacher workspace + admin-only sections.
const ADMIN_EXTRA = [["Admin", [["/admin/users", "Users", Users, false]]]];

function navForRole(role) {
  if (role === "student") return STUDENT_NAV;
  if (role === "admin") return [...TEACHER_NAV, ...ADMIN_EXTRA];
  return TEACHER_NAV;
}

export default function Layout({ children, bodyClass = "" }) {
  const { user } = useAuth();
  const [drawer, setDrawer] = useState(false);

  const groups = navForRole(user.role);

  return (
    <div className="app">
      <nav className={"sidebar" + (drawer ? " open" : "")}>
        <Link className="brand" to={roleHome(user.role)} onClick={() => setDrawer(false)}>
          <Brand />
        </Link>

        {groups.map(([heading, links]) => (
          <div className="sb-group" key={heading || "main"}>
            {heading && <div className="sb-group-h">{heading}</div>}
            {links.map(([to, label, Icon, end]) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setDrawer(false)}
                className={({ isActive }) => (isActive ? "on" : undefined)}
              >
                <Icon />
                {label}
              </NavLink>
            ))}
          </div>
        ))}

        {/* Pinned to the bottom: it fills the gap left when Sign out moved to
            the account menu, and reads as a footer rather than competing with
            the brand for the top of the panel. */}
        <div className="sb-user">
          <div className="avatar avatar-initials">{initials(user.name)}</div>
          <div>
            <strong>{user.name}</strong>
            <small>{cap(user.role)}</small>
          </div>
        </div>
      </nav>

      <div className={"scrim" + (drawer ? " show" : "")} onClick={() => setDrawer(false)} />

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn menu-btn"
            onClick={() => setDrawer(true)}
            aria-label="Menu"
          >
            <Menu />
          </button>
          {/* Below 900px the sidebar is off-canvas, so this is the only place
              the brand is visible without opening the menu. */}
          <Link className="brand topbar-brand" to={roleHome(user.role)}>
            <Brand size={28} tagline={false} />
          </Link>
          <span className="spacer" />
          <AccountMenu />
        </header>
        <main className={"body " + bodyClass}>{children}</main>
      </div>
    </div>
  );
}
