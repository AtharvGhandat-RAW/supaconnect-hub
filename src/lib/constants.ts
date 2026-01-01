// Application Constants

// Days of the week
export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday', 
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

// Working days (excluding weekends)
export const WORKING_DAYS = [
  'Monday',
  'Tuesday', 
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

// Attendance statuses
export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
} as const;

// Student statuses
export const STUDENT_STATUS = {
  ACTIVE: 'ACTIVE',
  YD: 'YD',
  PASSOUT: 'PASSOUT',
} as const;

// Leave statuses
export const LEAVE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

// Leave types
export const LEAVE_TYPE = {
  CL: 'CL',
  DL: 'DL',
  ML: 'ML',
  LWP: 'LWP',
} as const;

// Subject types
export const SUBJECT_TYPE = {
  TH: 'TH',  // Theory
  PR: 'PR',  // Practical
  TU: 'TU',  // Tutorial
} as const;

// Default values
export const DEFAULT_DEPARTMENT = 'AIML';
export const DEFAULT_ATTENDANCE_THRESHOLD = 75;
export const INDIA_COUNTRY_CODE = '91';

// Institution details
export const INSTITUTION = {
  NAME: 'RIT Polytechnic',
  LOCATION: 'Pune',
  DEPARTMENT: 'AIML Department',
  FULL_NAME: 'RIT Polytechnic, Pune - AIML Department',
} as const;

// Syllabus units (1-5 for polytechnic)
export const SYLLABUS_UNITS = [1, 2, 3, 4, 5] as const;

// Time gate defaults (in minutes)
export const TIME_GATE = {
  BEFORE_LECTURE_MINUTES: 30,
  AFTER_LECTURE_MINUTES: 60,
} as const;

// User roles
export const USER_ROLE = {
  ADMIN: 'ADMIN',
  FACULTY: 'FACULTY',
  STUDENT: 'STUDENT',
} as const;

// Types
export type DayOfWeek = typeof DAYS_OF_WEEK[number];
export type WorkingDay = typeof WORKING_DAYS[number];
export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];
export type StudentStatus = typeof STUDENT_STATUS[keyof typeof STUDENT_STATUS];
export type LeaveStatus = typeof LEAVE_STATUS[keyof typeof LEAVE_STATUS];
export type LeaveType = typeof LEAVE_TYPE[keyof typeof LEAVE_TYPE];
export type SubjectType = typeof SUBJECT_TYPE[keyof typeof SUBJECT_TYPE];
export type UserRole = typeof USER_ROLE[keyof typeof USER_ROLE];
