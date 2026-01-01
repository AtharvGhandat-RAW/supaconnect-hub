import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import RouteGuard from "@/components/auth/RouteGuard";

// Pages
import AdminLogin from "./pages/AdminLogin";
import FacultyLogin from "./pages/FacultyLogin";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminFaculty from "./pages/admin/Faculty";
import AdminClasses from "./pages/admin/Classes";
import AdminStudents from "./pages/admin/Students";
import AdminSubjects from "./pages/admin/Subjects";
import AdminAllocations from "./pages/admin/Allocations";
import AdminTimetable from "./pages/admin/Timetable";
import AdminFacultyLeave from "./pages/admin/FacultyLeave";
import AdminAttendanceMonitor from "./pages/admin/AttendanceMonitor";
import AdminSyllabusProgress from "./pages/admin/SyllabusProgress";
import AdminDefaulters from "./pages/admin/Defaulters";
import AdminPromotion from "./pages/admin/Promotion";
import AdminReports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/Settings";
import AdminBatches from "./pages/admin/Batches";

// Faculty Pages
import FacultyDashboard from "./pages/faculty/Dashboard";
import FacultyToday from "./pages/faculty/Today";
import FacultyAttendance from "./pages/faculty/Attendance";
import FacultyAttendanceView from "./pages/faculty/AttendanceView";
import FacultyLeave from "./pages/faculty/Leave";
import FacultyReports from "./pages/faculty/Reports";
import FacultySubjects from "./pages/faculty/Subjects";
import FacultySyllabus from "./pages/faculty/Syllabus";
import FacultySettings from "./pages/faculty/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<FacultyLogin />} />
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/login/faculty" element={<FacultyLogin />} />

          {/* Admin routes */}
          <Route path="/admin/dashboard" element={<RouteGuard allowedRole="ADMIN"><AdminDashboard /></RouteGuard>} />
          <Route path="/admin/faculty" element={<RouteGuard allowedRole="ADMIN"><AdminFaculty /></RouteGuard>} />
          <Route path="/admin/classes" element={<RouteGuard allowedRole="ADMIN"><AdminClasses /></RouteGuard>} />
          <Route path="/admin/students" element={<RouteGuard allowedRole="ADMIN"><AdminStudents /></RouteGuard>} />
          <Route path="/admin/subjects" element={<RouteGuard allowedRole="ADMIN"><AdminSubjects /></RouteGuard>} />
          <Route path="/admin/allocations" element={<RouteGuard allowedRole="ADMIN"><AdminAllocations /></RouteGuard>} />
          <Route path="/admin/timetable" element={<RouteGuard allowedRole="ADMIN"><AdminTimetable /></RouteGuard>} />
          <Route path="/admin/faculty-leave" element={<RouteGuard allowedRole="ADMIN"><AdminFacultyLeave /></RouteGuard>} />
          <Route path="/admin/attendance-monitor" element={<RouteGuard allowedRole="ADMIN"><AdminAttendanceMonitor /></RouteGuard>} />
          <Route path="/admin/syllabus-progress" element={<RouteGuard allowedRole="ADMIN"><AdminSyllabusProgress /></RouteGuard>} />
          <Route path="/admin/defaulters" element={<RouteGuard allowedRole="ADMIN"><AdminDefaulters /></RouteGuard>} />
          <Route path="/admin/promotion" element={<RouteGuard allowedRole="ADMIN"><AdminPromotion /></RouteGuard>} />
          <Route path="/admin/batches" element={<RouteGuard allowedRole="ADMIN"><AdminBatches /></RouteGuard>} />
          <Route path="/admin/reports" element={<RouteGuard allowedRole="ADMIN"><AdminReports /></RouteGuard>} />
          <Route path="/admin/settings" element={<RouteGuard allowedRole="ADMIN"><AdminSettings /></RouteGuard>} />

          {/* Faculty routes */}
          <Route path="/faculty/dashboard" element={<RouteGuard allowedRole="FACULTY"><FacultyDashboard /></RouteGuard>} />
          <Route path="/faculty/today" element={<RouteGuard allowedRole="FACULTY"><FacultyToday /></RouteGuard>} />
          <Route path="/faculty/attendance/:sessionId" element={<RouteGuard allowedRole="FACULTY"><FacultyAttendance /></RouteGuard>} />
          <Route path="/faculty/attendance/:sessionId/view" element={<RouteGuard allowedRole="FACULTY"><FacultyAttendanceView /></RouteGuard>} />
          <Route path="/faculty/leave" element={<RouteGuard allowedRole="FACULTY"><FacultyLeave /></RouteGuard>} />
          <Route path="/faculty/reports" element={<RouteGuard allowedRole="FACULTY"><FacultyReports /></RouteGuard>} />
          <Route path="/faculty/subjects" element={<RouteGuard allowedRole="FACULTY"><FacultySubjects /></RouteGuard>} />
          <Route path="/faculty/batches" element={<RouteGuard allowedRole="FACULTY"><AdminBatches role="faculty" /></RouteGuard>} />
          <Route path="/faculty/syllabus" element={<RouteGuard allowedRole="FACULTY"><FacultySyllabus /></RouteGuard>} />
          <Route path="/faculty/settings" element={<RouteGuard allowedRole="FACULTY"><FacultySettings /></RouteGuard>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
