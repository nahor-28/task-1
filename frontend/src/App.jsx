import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Layout } from './components/Layout.jsx';
import { Login } from './pages/Login.jsx';
import { Register } from './pages/Register.jsx';
import { VerifyEmail } from './pages/VerifyEmail.jsx';
import { StudentDashboard } from './pages/student/StudentDashboard.jsx';
import { Courses as StudentCourses } from './pages/student/Courses.jsx';
import { CourseDetail as StudentCourseDetail } from './pages/student/CourseDetail.jsx';
import { Groups } from './pages/student/Groups.jsx';
import { AssignmentDetail as StudentAssignmentDetail } from './pages/student/AssignmentDetail.jsx';
import { Reports as StudentReports } from './pages/student/Reports.jsx';
import { EducatorDashboard } from './pages/educator/EducatorDashboard.jsx';
import { Courses as EducatorCourses } from './pages/educator/Courses.jsx';
import { CourseDetail as EducatorCourseDetail } from './pages/educator/CourseDetail.jsx';
import { Assignments as EducatorAssignments } from './pages/educator/Assignments.jsx';
import { AssignmentForm } from './pages/educator/AssignmentForm.jsx';
import { AssignmentDetail as EducatorAssignmentDetail } from './pages/educator/AssignmentDetail.jsx';
import { Reports as EducatorReports } from './pages/educator/Reports.jsx';

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'educator' ? '/educator/dashboard' : '/student/dashboard'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<VerifyEmail />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />

        <Route path="/student/dashboard" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/courses" element={<ProtectedRoute role="student"><StudentCourses /></ProtectedRoute>} />
        <Route path="/student/courses/:id" element={<ProtectedRoute role="student"><StudentCourseDetail /></ProtectedRoute>} />
        <Route path="/student/assignments/:id" element={<ProtectedRoute role="student"><StudentAssignmentDetail /></ProtectedRoute>} />
        <Route path="/student/assignments/:id/groups" element={<ProtectedRoute role="student"><Groups /></ProtectedRoute>} />
        <Route path="/student/reports" element={<ProtectedRoute role="student"><StudentReports /></ProtectedRoute>} />

        <Route path="/educator/dashboard" element={<ProtectedRoute role="educator"><EducatorDashboard /></ProtectedRoute>} />
        <Route path="/educator/courses" element={<ProtectedRoute role="educator"><EducatorCourses /></ProtectedRoute>} />
        <Route path="/educator/courses/:id" element={<ProtectedRoute role="educator"><EducatorCourseDetail /></ProtectedRoute>} />
        <Route path="/educator/assignments" element={<ProtectedRoute role="educator"><EducatorAssignments /></ProtectedRoute>} />
        <Route path="/educator/assignments/new" element={<ProtectedRoute role="educator"><AssignmentForm /></ProtectedRoute>} />
        <Route path="/educator/assignments/:id/edit" element={<ProtectedRoute role="educator"><AssignmentForm /></ProtectedRoute>} />
        <Route path="/educator/assignments/:id" element={<ProtectedRoute role="educator"><EducatorAssignmentDetail /></ProtectedRoute>} />
        <Route path="/educator/reports" element={<ProtectedRoute role="educator"><EducatorReports /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
