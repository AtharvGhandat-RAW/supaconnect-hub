/**
 * Fingerprint Device Service
 * Handles device configuration and session management for faculty
 */

import { supabase } from '@/integrations/supabase/client';

export interface FingerprintDevice {
  id: string;
  device_code: string;
  device_name: string | null;
  status: string;
  last_seen_at: string | null;
  firmware_version: string | null;
  created_at: string;
}

export interface DeviceSession {
  id: string;
  device_id: string;
  faculty_id: string;
  class_id: string;
  subject_id: string;
  batch_id: string | null;
  attendance_session_id: string | null;
  session_date: string;
  start_time: string;
  session_status: string;
  created_at: string;
  device?: FingerprintDevice;
  classes?: { name: string; division: string };
  subjects?: { name: string; subject_code: string };
}

// Get all available devices
export async function getAvailableDevices(): Promise<FingerprintDevice[]> {
  const { data, error } = await supabase
    .from('fingerprint_devices')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('device_code');

  if (error) throw error;
  return data || [];
}

// Get device by code
export async function getDeviceByCode(deviceCode: string): Promise<FingerprintDevice | null> {
  const { data, error } = await supabase
    .from('fingerprint_devices')
    .select('*')
    .eq('device_code', deviceCode)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Check if device is online (last seen within 2 minutes)
export function isDeviceOnline(device: FingerprintDevice): boolean {
  if (!device.last_seen_at) return false;
  const lastSeen = new Date(device.last_seen_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
  return diffMinutes < 2;
}

// Configure device for attendance session
export async function configureDeviceForAttendance(params: {
  deviceCode: string;
  facultyId: string;
  classId: string;
  subjectId: string;
  batchId?: string | null;
  attendanceSessionId: string;
  date: string;
  startTime: string;
}): Promise<DeviceSession> {
  // Get device ID from code
  const device = await getDeviceByCode(params.deviceCode);
  if (!device) {
    throw new Error('Device not found. Please check the device code.');
  }

  // Check if device is online
  if (!isDeviceOnline(device)) {
    throw new Error('Device appears to be offline. Please ensure it is powered on and connected to WiFi.');
  }

  // Deactivate any existing active sessions for this device
  await supabase
    .from('device_sessions')
    .update({ session_status: 'COMPLETED' })
    .eq('device_id', device.id)
    .eq('session_status', 'ACTIVE');

  // Create new device session
  const { data, error } = await supabase
    .from('device_sessions')
    .insert({
      device_id: device.id,
      faculty_id: params.facultyId,
      class_id: params.classId,
      subject_id: params.subjectId,
      batch_id: params.batchId || null,
      attendance_session_id: params.attendanceSessionId,
      session_date: params.date,
      start_time: params.startTime,
      session_status: 'ACTIVE'
    })
    .select(`
      *,
      fingerprint_devices (*),
      classes (name, division),
      subjects (name, subject_code)
    `)
    .single();

  if (error) throw error;
  return data;
}

// Get active device session for faculty
export async function getActiveDeviceSession(facultyId: string): Promise<DeviceSession | null> {
  const { data, error } = await supabase
    .from('device_sessions')
    .select(`
      *,
      fingerprint_devices (*),
      classes (name, division),
      subjects (name, subject_code)
    `)
    .eq('faculty_id', facultyId)
    .eq('session_status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// End device session
export async function endDeviceSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('device_sessions')
    .update({ session_status: 'COMPLETED' })
    .eq('id', sessionId);

  if (error) throw error;
}

// Get students with fingerprint enrollment status for a class
export async function getStudentsEnrollmentStatus(classId: string): Promise<{
  id: string;
  name: string;
  enrollment_no: string;
  roll_no: number;
  has_fingerprint: boolean;
}[]> {
  // Get all students in class
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, name, enrollment_no, roll_no')
    .eq('class_id', classId)
    .eq('status', 'ACTIVE')
    .order('roll_no');

  if (studentsError) throw studentsError;
  if (!students || students.length === 0) return [];

  // Get fingerprint templates
  const studentIds = students.map(s => s.id);
  const { data: templates, error: templatesError } = await supabase
    .from('fingerprint_templates')
    .select('student_id')
    .in('student_id', studentIds);

  if (templatesError) throw templatesError;

  const enrolledStudentIds = new Set(templates?.map(t => t.student_id) || []);

  return students.map(s => ({
    ...s,
    has_fingerprint: enrolledStudentIds.has(s.id)
  }));
}

// Delete fingerprint template for a student
export async function deleteStudentFingerprint(studentId: string): Promise<void> {
  const { error } = await supabase
    .from('fingerprint_templates')
    .delete()
    .eq('student_id', studentId);

  if (error) throw error;
}

// Get device session history
export async function getDeviceSessionHistory(facultyId: string, limit: number = 10): Promise<DeviceSession[]> {
  const { data, error } = await supabase
    .from('device_sessions')
    .select(`
      *,
      fingerprint_devices (device_code, device_name),
      classes (name, division),
      subjects (name, subject_code)
    `)
    .eq('faculty_id', facultyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Subscribe to device status changes (real-time)
export function subscribeToDeviceStatus(
  deviceCode: string,
  callback: (device: FingerprintDevice) => void
) {
  return supabase
    .channel(`device_${deviceCode}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'fingerprint_devices',
        filter: `device_code=eq.${deviceCode}`
      },
      (payload) => {
        callback(payload.new as FingerprintDevice);
      }
    )
    .subscribe();
}

// Subscribe to attendance records for session (real-time)
export function subscribeToAttendanceRecords(
  sessionId: string,
  callback: (record: { student_id: string; status: string }) => void
) {
  return supabase
    .channel(`attendance_${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'attendance_records',
        filter: `session_id=eq.${sessionId}`
      },
      (payload) => {
        callback(payload.new as { student_id: string; status: string });
      }
    )
    .subscribe();
}
