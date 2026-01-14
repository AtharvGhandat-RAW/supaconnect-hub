import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  ClipboardList,
  FileBarChart,
  Settings,
  LogOut,
  Menu,
  X,
  UserCog,
  CalendarOff,
  AlertTriangle,
  ArrowUpCircle,
  Link2,
  CalendarDays,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import ritLogo from '@/assets/rit-logo.jpg';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Faculty', path: '/admin/faculty', icon: <UserCog className="w-5 h-5" /> },
  { label: 'Classes', path: '/admin/classes', icon: <GraduationCap className="w-5 h-5" /> },
  { label: 'Subjects', path: '/admin/subjects', icon: <BookOpen className="w-5 h-5" /> },
  { label: 'Allocations', path: '/admin/allocations', icon: <Link2 className="w-5 h-5" /> },
  { label: 'Students', path: '/admin/students', icon: <Users className="w-5 h-5" /> },
  { label: 'Batches', path: '/admin/batches', icon: <Users className="w-5 h-5" /> },
  { label: 'Timetable', path: '/admin/timetable', icon: <Calendar className="w-5 h-5" /> },
  { label: 'Holidays', path: '/admin/holidays', icon: <CalendarDays className="w-5 h-5" /> },
  { label: 'Faculty Leave', path: '/admin/faculty-leave', icon: <CalendarOff className="w-5 h-5" /> },
  { label: 'Substitutions', path: '/admin/substitutions', icon: <RefreshCw className="w-5 h-5" /> },
  { label: 'Attendance', path: '/admin/attendance-monitor', icon: <ClipboardList className="w-5 h-5" /> },
  { label: 'Defaulters', path: '/admin/defaulters', icon: <AlertTriangle className="w-5 h-5" /> },
  { label: 'Promotion', path: '/admin/promotion', icon: <ArrowUpCircle className="w-5 h-5" /> },
  { label: 'Reports', path: '/admin/reports', icon: <FileBarChart className="w-5 h-5" /> },
  { label: 'Settings', path: '/admin/settings', icon: <Settings className="w-5 h-5" /> },
];

const facultyNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/faculty/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: "Today's Lectures", path: '/faculty/today', icon: <Calendar className="w-5 h-5" /> },
  { label: 'Leave', path: '/faculty/leave', icon: <CalendarOff className="w-5 h-5" /> },
  { label: 'Reports', path: '/faculty/reports', icon: <FileBarChart className="w-5 h-5" /> },
  { label: 'My Subjects', path: '/faculty/subjects', icon: <BookOpen className="w-5 h-5" /> },
  { label: 'Batches', path: '/faculty/batches', icon: <Users className="w-5 h-5" /> },
  { label: 'Settings', path: '/faculty/settings', icon: <Settings className="w-5 h-5" /> },
];

interface PageShellProps {
  children: React.ReactNode;
  role: 'admin' | 'faculty';
}

export const PageShell: React.FC<PageShellProps> = ({ children, role }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const navItems = role === 'admin' ? adminNavItems : facultyNavItems;

  const handleLogout = async () => {
    await signOut();
    navigate(role === 'admin' ? '/login/admin' : '/login/faculty');
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src={ritLogo} alt="RIT Logo" className="w-10 h-10 rounded-full object-cover" />
            <span className="font-display font-semibold text-foreground">RIT AIML</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-foreground"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || typeof window !== 'undefined' && window.innerWidth >= 1024) && (
          <>
            {/* Overlay for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 z-40"
              onClick={() => setSidebarOpen(false)}
            />

            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-64 glass-card border-r border-border/50 z-50 lg:z-30 flex flex-col"
            >
              {/* Logo */}
              <div className="p-6 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <img src={ritLogo} alt="RIT Logo" className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/30" />
                  <div>
                    <h1 className="font-display font-bold text-foreground text-sm">RIT Polytechnic</h1>
                    <p className="text-xs text-muted-foreground">AIML Department</p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto py-4 px-3">
                <ul className="space-y-1">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                            }`}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* User & Logout */}
              <div className="p-4 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-3 truncate">
                  {user?.email}
                </div>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full border-border/50 text-muted-foreground hover:text-foreground hover:bg-white/5"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar (always visible) */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 glass-card border-r border-border/50 z-30 flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <img src={ritLogo} alt="RIT Logo" className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/30" />
            <div>
              <h1 className="font-display font-bold text-foreground text-sm">RIT Polytechnic</h1>
              <p className="text-xs text-muted-foreground">AIML Department</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                      }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-border/50">
          <div className="text-xs text-muted-foreground mb-3 truncate">
            {user?.email}
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full border-border/50 text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-20 lg:pt-0">
        {/* Top Bar */}
        <div className="hidden lg:flex items-center justify-between p-6 border-b border-border/30">
          <div>
            <p className="text-sm text-muted-foreground">{today}</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Notifications removed */}
          </div>
        </div>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default PageShell;
