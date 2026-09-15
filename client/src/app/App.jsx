import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { BootLoader } from "@/shared/components/ui";
import ProtectedRoute from "@/features/auth/components/ProtectedRoute";
import { roleHome } from "@/shared/lib/roles";

import Login from "@/features/auth/pages/Login";
import Signup from "@/features/auth/pages/Signup";
import ForgotPassword from "@/features/auth/pages/ForgotPassword";

// student
import Dashboard from "@/features/student/pages/Dashboard";
import Catalog from "@/features/student/pages/Catalog";
import CourseDetails from "@/features/student/pages/CourseDetails";
import MyLearning from "@/features/student/pages/MyLearning";
import LessonPlayer from "@/features/student/pages/LessonPlayer";
import ProgressPage from "@/features/student/pages/ProgressPage";
import StudentAssignments from "@/features/student/pages/StudentAssignments";
import AssessmentDetail from "@/features/student/pages/AssessmentDetail";
import StudentDoubts from "@/features/student/pages/StudentDoubts";

// teacher / admin
import TeacherDashboard from "@/features/teacher/pages/TeacherDashboard";
import ManageCourses from "@/features/teacher/pages/ManageCourses";
import CourseEditor from "@/features/teacher/pages/CourseEditor";
import CourseEnrollments from "@/features/teacher/pages/CourseEnrollments";
import TeacherStudents from "@/features/teacher/pages/TeacherStudents";
import TeacherAssignments from "@/features/teacher/pages/TeacherAssignments";
import TeacherDoubts from "@/features/teacher/pages/TeacherDoubts";
import TeacherPerformance from "@/features/teacher/pages/TeacherPerformance";
import AdminUsers from "@/features/admin/pages/AdminUsers";

// shared
import Profile from "@/features/account/pages/Profile";
import NotFound from "./NotFound";

const student = ["student"];
const staff = ["teacher", "admin"];

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <BootLoader label="Loading your learning hub…" />;

  const home = user ? roleHome(user.role) : "/login";
  const S = (el, roles) => <ProtectedRoute roles={roles}>{el}</ProtectedRoute>;

  return (
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
  );
}
