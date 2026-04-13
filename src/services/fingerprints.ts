import { supabase } from '@/integrations/supabase/client';

export interface StudentFingerprint {
  id: string;
  name: string;
  enrollment_no: string;
  class_id: string;
}

export interface FingerprintTemplate {
  id: string;
  student_id: string;
  fingerprint_id: number;
  is_verified: boolean;
  created_at: string;
}

/**
 * Get student by fingerprint ID from fingerprint_templates table
 */
export async function getStudentByFingerprint(fingerprintId: number) {
  try {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .select(
        `
        id,
        student_id,
        fingerprint_id,
        is_verified,
        students(id, name, enrollment_no, class_id)
      `
      )
      .eq('fingerprint_id', fingerprintId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching student by fingerprint:', error);
    throw error;
  }
}

/**
 * Check if student already has a fingerprint enrolled
 */
export async function checkStudentHasFingerprint(studentId: string) {
  try {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .select('id')
      .eq('student_id', studentId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No fingerprint found
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error checking student fingerprint:', error);
    throw error;
  }
}

/**
 * Save fingerprint template for student
 */
export async function saveFingerprint(
  studentId: string,
  fingerprintId: number,
  templateData?: string
) {
  try {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .insert([
        {
          student_id: studentId,
          fingerprint_id: fingerprintId,
          template_data: templateData || null,
          is_verified: true
        }
      ])
      .select();

    if (error) throw error;

    return data?.[0];
  } catch (error) {
    console.error('Error saving fingerprint:', error);
    throw error;
  }
}

/**
 * Update fingerprint template
 */
export async function updateFingerprint(
  fingerprintId: number,
  studentId: string,
  templateData?: string
) {
  try {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .update({
        template_data: templateData || null,
        is_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('student_id', studentId)
      .select();

    if (error) throw error;

    return data?.[0];
  } catch (error) {
    console.error('Error updating fingerprint:', error);
    throw error;
  }
}

/**
 * Delete fingerprint template
 */
export async function deleteFingerprint(fingerprintId: number) {
  try {
    const { error } = await supabase
      .from('fingerprint_templates')
      .delete()
      .eq('fingerprint_id', fingerprintId);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error deleting fingerprint:', error);
    throw error;
  }
}

/**
 * Get all fingerprints for a class
 */
export async function getClassFingerprints(classId: string) {
  try {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .select(
        `
        id,
        fingerprint_id,
        student_id,
        is_verified,
        students(id, name, enrollment_no)
      `
      )
      .eq('students.class_id', classId);

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching class fingerprints:', error);
    throw error;
  }
}

/**
 * Mark attendance after fingerprint match
 */
export async function markAttendanceByFingerprint(
  sessionId: string,
  studentId: string
) {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(
        [
          {
            session_id: sessionId,
            student_id: studentId,
            status: 'PRESENT',
            remarks: 'Fingerprint verified'
          }
        ],
        {
          onConflict: 'session_id,student_id'
        }
      )
      .select();

    if (error) throw error;

    return data?.[0];
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
}

/**
 * Get active attendance session for device
 */
export async function getActiveSession(deviceId: string) {
  try {
    const { data, error } = await supabase
      .from('device_sessions')
      .select(
        `
        id,
        device_id,
        session_date,
        session_status,
        attendance_session_id
      `
      )
      .eq('device_id', deviceId)
      .eq('session_status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code === 'PGRST116') {
      // No active session
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching active session:', error);
    return null;
  }
}

/**
 * Get all students with fingerprints
 */
export async function getAllEnrolledStudents() {
  try {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .select(
        `
        id,
        fingerprint_id,
        students(id, name, enrollment_no, class_id, classes(name))
      `
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching enrolled students:', error);
    throw error;
  }
}

/**
 * Verify fingerprint exists in database
 */
export async function verifyFingerprint(fingerprintId: number) {
  try {
    const { count, error } = await supabase
      .from('fingerprint_templates')
      .select('*', { count: 'exact', head: true })
      .eq('fingerprint_id', fingerprintId);

    if (error) throw error;

    return count && count > 0;
  } catch (error) {
    console.error('Error verifying fingerprint:', error);
    return false;
  }
}
