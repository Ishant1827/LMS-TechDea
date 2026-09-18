import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { BootLoader } from "@/shared/components/ui";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import { roleHome } from "@/shared/lib/roles";

import Login from "@/features/auth/pages/Login";
import Signup from "@/features/auth/pages/Signup";
import ForgotPassword from "@/features/auth/pages/ForgotPassword";
import VerifyEmail from "@/features/auth/pages/VerifyEmail";
import ForcePasswordChange from "@/features/auth/pages/ForcePasswordChange";

// student
import Dashboard from "@/features/student/Dashboard";
import Catalog from "@/features/student/Catalog";
import CourseDetails from "@/features/student/CourseDetails";
import MyLearning from "@/features/student/MyLearning";
import LessonPlayer from "@/features/student/LessonPlayer";
import ProgressPage from "@/features/student/ProgressPage";
import StudentAssignments from "@/features/student/StudentAssignments";
import AssessmentDetail from "@/features/student/AssessmentDetail";
import StudentDoubts from "@/features/student/StudentDoubts";

// teacher / admin
import TeacherDashboard from "@/features/teacher/pages/TeacherDashboard";
import ManageCourses from "@/features/teacher/pages/ManageCourses";
import CourseEditor from "@/features/teacher/pages/CourseEditor";
import CourseEnrollments from "@/features/teacher/pages/CourseEnrollments";
import TeacherStudents from "@/features/teacher/pages/TeacherStudents";
import TeacherAssignments from "@/features/teacher/pages/TeacherAssignments";
import TeacherDoubts from "@/features/teacher/pages/TeacherDoubts";
import TeacherPerformance from "@/features/teacher/pages/TeacherPerformance";
import AdminUsers from "@/features/admin/AdminUsers";

// shared
import Profile from "@/features/account/Profile";
import NotFound from "./NotFound";

const student = ["student"];
const staff = ["teacher", "admin"];

export default function App() {
  const { user, loading, bootError, retryBoot } = useAuth();
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

  // Registering signs the user in, which makes the /signup route below redirect
  // immediately — racing the navigate() inside Signup. Rather than depend on
  // which lands first, both are pointed at the same place.
  //
  // Only signup goes here. Sending an unverified student to the code screen on
  // every *sign-in* would be a hard gate wearing a soft gate's clothes; there
  // the banner does the asking.
  const afterSignup =
    user && user.role === "student" && !user.emailVerifiedAt ? "/verify-email" : home;
  const S = (el, roles) => <ProtectedRoute roles={roles}>{el}</ProtectedRoute>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to={afterSignup} replace /> : <Signup />} />
      <Route path="/forgot-password" element={user ? <Navigate to={home} replace /> : <ForgotPassword />} />

      {/* Reachable signed in *or* out: the code arrives by email, and email is
          often opened on a different device from the one that signed up. */}
      <Route path="/verify-email" element={<VerifyEmail />} />

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
  );
}
