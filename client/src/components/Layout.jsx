import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Compass,
  BookOpen,
  GraduationCap,
  Menu,
  Bell,
  Users,
  ClipboardList,
  TrendingUp,
  MessageCircleQuestion,
  BarChart3,
  Library,
  User,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { initials, cap } from "../lib/format";
import { roleHome } from "../lib/roles";

// [path, label, Icon, end?]
const STUDENT_NAV = [
  ["/", "Dashboard", LayoutDashboard, true],
  ["/courses", "Browse Courses", Compass, false],
  ["/my-learning", "My Learning", BookOpen, false],
  ["/assignments", "Assignments & Quizzes", ClipboardList, false],
  ["/progress", "Progress", TrendingUp, false],
  ["/doubts", "Doubts", MessageCircleQuestion, false],
  ["/profile", "Profile", User, false],
];

const TEACHER_NAV = [
  ["/teach", "Dashboard", LayoutDashboard, true],
  ["/manage", "Courses", BookOpen, false],
  ["/teach/assignments", "Assignments & Quizzes", ClipboardList, false],
  ["/teach/students", "Students", Users, false],
  ["/teach/doubts", "Doubts", MessageCircleQuestion, false],
  ["/teach/performance", "Performance", BarChart3, false],
  ["/profile", "Profile", User, false],
];

// Admin = teacher workspace + admin-only sections.
const ADMIN_EXTRA = [
  ["/admin/users", "Users", Users, false],
  ["/admin/catalog", "Catalog", Library, false],
];

function navForRole(role) {
  if (role === "student") return STUDENT_NAV;
  if (role === "admin") {
    // insert admin items before Profile
    const base = TEACHER_NAV.slice(0, -1);
    return [...base, ...ADMIN_EXTRA, TEACHER_NAV[TEACHER_NAV.length - 1]];
  }
  return TEACHER_NAV;
}

export default function Layout({ children, bodyClass = "" }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [drawer, setDrawer] = useState(false);

  const items = navForRole(user.role);

  const signOut = () => {
    logout();
    nav("/login", { replace: true });
  };

  return (
    <div className="app">
      <nav className={"sidebar" + (drawer ? " open" : "")}>
        <Link className="brand" to={roleHome(user.role)} onClick={() => setDrawer(false)}>
          <span className="brand-mark">
            <GraduationCap />
          </span>
          <span className="brand-word">
            Tech<span>Dea</span>
          </span>
        </Link>

        <div className="sb-user">
          <div className="avatar avatar-initials">{initials(user.name)}</div>
          <div>
            <strong>{user.name}</strong>
            <small>{cap(user.role)}</small>
          </div>
        </div>

        {items.map(([to, label, Icon, end]) => (
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

        <button className="sb-logout" onClick={signOut}>
          <LogOut />
          Sign out
        </button>
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
          <button className="icon-btn spacer" aria-label="Notifications">
            <Bell />
          </button>
          <Link className="topbar-user" to="/profile" title={user.name}>
            <span className="topbar-name">{user.name}</span>
            <div className="avatar avatar-initials">{initials(user.name)}</div>
          </Link>
        </header>
        <main className={"body " + bodyClass}>{children}</main>
      </div>
    </div>
  );
}
