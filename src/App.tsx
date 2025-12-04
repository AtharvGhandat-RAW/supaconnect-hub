import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import RouteGuard from "@/components/auth/RouteGuard";

// Pages
import Splash from "./pages/Splash";
import AdminLogin from "./pages/AdminLogin";
import FacultyLogin from "./pages/FacultyLogin";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminFaculty from "./pages/admin/Faculty";
import AdminClasses from "./pages/admin/Classes";
import AdminStudents from "./pages/admin/Students";
import AdminSubjects from "./pages/admin/Subjects";
import AdminAttendanceMonitor from "./pages/admin/AttendanceMonitor";
import AdminSettings from "./pages/admin/Settings";

// Faculty Pages
import FacultyDashboard from "./pages/faculty/Dashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Splash />} />
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/login/faculty" element={<FacultyLogin />} />

          {/* Admin routes */}
          <Route path="/admin/dashboard" element={<RouteGuard allowedRole="ADMIN"><AdminDashboard /></RouteGuard>} />
          <Route path="/admin/faculty" element={<RouteGuard allowedRole="ADMIN"><AdminFaculty /></RouteGuard>} />
          <Route path="/admin/classes" element={<RouteGuard allowedRole="ADMIN"><AdminClasses /></RouteGuard>} />
          <Route path="/admin/students" element={<RouteGuard allowedRole="ADMIN"><AdminStudents /></RouteGuard>} />
          <Route path="/admin/subjects" element={<RouteGuard allowedRole="ADMIN"><AdminSubjects /></RouteGuard>} />
          <Route path="/admin/attendance-monitor" element={<RouteGuard allowedRole="ADMIN"><AdminAttendanceMonitor /></RouteGuard>} />
          <Route path="/admin/settings" element={<RouteGuard allowedRole="ADMIN"><AdminSettings /></RouteGuard>} />

          {/* Faculty routes */}
          <Route path="/faculty/dashboard" element={<RouteGuard allowedRole="FACULTY"><FacultyDashboard /></RouteGuard>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
