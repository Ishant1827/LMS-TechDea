import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { BootLoader } from "./components/Bits";
import ProtectedRoute from "./components/ProtectedRoute";
import { roleHome } from "./lib/roles";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";

// student
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import CourseDetails from "./pages/CourseDetails";
import MyLearning from "./pages/MyLearning";
import LessonPlayer from "./pages/LessonPlayer";
import ProgressPage from "./pages/ProgressPage";
import StudentAssignments from "./pages/StudentAssignments";
import AssessmentDetail from "./pages/AssessmentDetail";
import StudentDoubts from "./pages/StudentDoubts";

// teacher / admin
import TeacherDashboard from "./pages/TeacherDashboard";
import ManageCourses from "./pages/ManageCourses";
import CourseEditor from "./pages/CourseEditor";
import CourseEnrollments from "./pages/CourseEnrollments";
import TeacherStudents from "./pages/TeacherStudents";
import TeacherAssignments from "./pages/TeacherAssignments";
import TeacherDoubts from "./pages/TeacherDoubts";
import TeacherPerformance from "./pages/TeacherPerformance";
import AdminUsers from "./pages/AdminUsers";
import AdminCatalog from "./pages/AdminCatalog";

// shared
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

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
      <Route path="/admin/catalog" element={S(<AdminCatalog />, ["admin"])} />

      {/* ── shared ────────────────────────────────────────── */}
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      <Route path="*" element={user ? <NotFound /> : <Navigate to={home} replace />} />
    </Routes>
  );
}
