import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { BootLoader } from "@/shared/components/ui";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import WelcomeScreen from "@/shared/components/layout/WelcomeScreen";
import { roleHome } from "@/shared/lib/roles";

import Login from "@/features/auth/pages/Login";
import Signup from "@/features/auth/pages/Signup";
import ForgotPassword from "@/features/auth/pages/ForgotPassword";
import ForcePasswordChange from "@/features/auth/pages/ForcePasswordChange";

// Pages load on demand: a student never downloads the course editor, and the
// first screen arrives with far less JavaScript. Each role's pages are then
// fetched in the background (see usePrefetch) so moving around stays instant.
const studentPages = {
  Dashboard: () => import("@/features/student/Dashboard"),
  Catalog: () => import("@/features/student/Catalog"),
  CourseDetails: () => import("@/features/student/CourseDetails"),
  MyLearning: () => import("@/features/student/MyLearning"),
  LessonPlayer: () => import("@/features/student/LessonPlayer"),
  ProgressPage: () => import("@/features/student/ProgressPage"),
  StudentAssignments: () => import("@/features/student/StudentAssignments"),
  AssessmentDetail: () => import("@/features/student/AssessmentDetail"),
  StudentDoubts: () => import("@/features/student/StudentDoubts"),
};
const staffPages = {
  TeacherDashboard: () => import("@/features/teacher/pages/TeacherDashboard"),
  ManageCourses: () => import("@/features/teacher/pages/ManageCourses"),
  CourseEditor: () => import("@/features/teacher/pages/CourseEditor"),
  CourseEnrollments: () => import("@/features/teacher/pages/CourseEnrollments"),
  TeacherStudents: () => import("@/features/teacher/pages/TeacherStudents"),
  TeacherAssignments: () => import("@/features/teacher/pages/TeacherAssignments"),
  TeacherDoubts: () => import("@/features/teacher/pages/TeacherDoubts"),
  TeacherPerformance: () => import("@/features/teacher/pages/TeacherPerformance"),
  AdminUsers: () => import("@/features/admin/AdminUsers"),
};
const sharedPages = { Profile: () => import("@/features/account/Profile") };

const {
  Dashboard, Catalog, CourseDetails, MyLearning, LessonPlayer, ProgressPage,
  StudentAssignments, AssessmentDetail, StudentDoubts,
} = Object.fromEntries(Object.entries(studentPages).map(([k, f]) => [k, lazy(f)]));
const {
  TeacherDashboard, ManageCourses, CourseEditor, CourseEnrollments, TeacherStudents,
  TeacherAssignments, TeacherDoubts, TeacherPerformance, AdminUsers,
} = Object.fromEntries(Object.entries(staffPages).map(([k, f]) => [k, lazy(f)]));
const Profile = lazy(sharedPages.Profile);

// Once the first screen is up, fetch the rest of this role's pages while the
// browser is idle, so a click never waits on a download.
function usePrefetch(role) {
  useEffect(() => {
    if (!role) return;
    const pages = { ...(role === "student" ? studentPages : staffPages), ...sharedPages };
    const run = () => Object.values(pages).forEach((load) => load().catch(() => {}));
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    const id = idle(run);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, [role]);
}

import NotFound from "./NotFound";

const student = ["student"];
const staff = ["teacher", "admin"];

export default function App() {
  const { user, loading, bootError, retryBoot } = useAuth();
  usePrefetch(user?.role);
  if (loading) return <BootLoader label="Loading your learning hub…" />;

  // The session couldn't be verified — the token may well still be good, so
  // offer a retry instead of dumping the user at the sign-in form.
  if (bootError)
    return (
      <div className="loader-screen loader-screen--boot">
        <div className="boundary-card">
          <h3>Can't reach TechDea</h3>
          <p className="text-muted">{bootError.message}</p>
          <div className="boundary-actions">
            <button type="button" className="btn btn-primary" onClick={retryBoot}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );

  // An account still carrying a password somebody else chose gets one screen and
  // nothing else. The server refuses every other endpoint anyway (see protect),
  // so routing them into the app would only show a dashboard whose every button
  // fails. Above the route table on purpose: there is no URL around it.
  if (user?.mustChangePassword) return <ForcePasswordChange />;

  const home = user ? roleHome(user.role) : "/login";

  const S = (el, roles) => <ProtectedRoute roles={roles}>{el}</ProtectedRoute>;

  return (
    <>
      {/* after sign-in only; the page below loads while it's showing */}
      {user && <WelcomeScreen key={user._id} user={user} />}
      {/* Normally the page's code is already prefetched; on a cold first
          load this blank frame shows for a moment instead of a spinner. */}
      <Suspense fallback={<div className="route-loading" aria-busy="true" />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to={home} replace /> : <Login />} />
          <Route path="/signup" element={user ? <Navigate to={home} replace /> : <Signup />} />
          <Route path="/forgot-password" element={user ? <Navigate to={home} replace /> : <ForgotPassword />} />


          {/* ── student workspace ─────────────────────────────── */}
          <Route path="/" element={S(<Dashboard />, student)} />
          <Route path="/courses" element={S(<Catalog />, student)} />
          <Route path="/courses/:id" element={S(<CourseDetails />, student)} />
          <Route path="/my-learning" element={S(<MyLearning />, student)} />
          <Route path="/my-courses" element={<Navigate to="/my-learning" replace />} />
          <Route path="/learn/:courseId/:lessonId" element={S(<LessonPlayer />, student)} />
          <Route path="/assignments" element={S(<StudentAssignments />, student)} />
          <Route path="/assignments/:id" element={S(<AssessmentDetail />, student)} />
          <Route path="/progress" element={S(<ProgressPage />, student)} />
          <Route path="/doubts" element={S(<StudentDoubts />, student)} />

          {/* ── teacher / admin workspace ─────────────────────── */}
          <Route path="/teach" element={S(<TeacherDashboard />, staff)} />
          <Route path="/manage" element={S(<ManageCourses />, staff)} />
          <Route path="/manage/courses/new" element={S(<CourseEditor />, staff)} />
          <Route path="/manage/courses/:id" element={S(<CourseEditor />, staff)} />
          <Route path="/manage/courses/:id/enrollments" element={S(<CourseEnrollments />, staff)} />
          <Route path="/teach/assignments" element={S(<TeacherAssignments />, staff)} />
          <Route path="/teach/students" element={S(<TeacherStudents />, staff)} />
          <Route path="/teach/doubts" element={S(<TeacherDoubts />, staff)} />
          <Route path="/teach/performance" element={S(<TeacherPerformance />, staff)} />

          {/* ── admin only ────────────────────────────────────── */}
          <Route path="/admin/users" element={S(<AdminUsers />, ["admin"])} />

          {/* ── shared ────────────────────────────────────────── */}
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          <Route path="*" element={user ? <NotFound /> : <Navigate to={home} replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
