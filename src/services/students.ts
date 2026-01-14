import { supabase } from '@/integrations/supabase/client';
import { SecurityValidator, SecureLogger } from '@/utils/security';

export interface Student {
  id: string;
  enrollment_no: string | null;
  roll_no: number | null;
  name: string;
  year: number;
  semester: number;
  class_id: string | null;
  division: string | null;
  department: string | null;
  mobile: string | null;
  email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function getStudents(filters?: {
  class_id?: string;
  year?: number;
  semester?: number;
  status?: string;
}) {
  try {
    let query = supabase
      .from('students')
      .select('*')
      .order('roll_no', { ascending: true });

    // Validate and apply filters securely
    if (filters?.class_id && SecurityValidator.isValidUUID(filters.class_id)) {
      query = query.eq('class_id', filters.class_id);
    }
    if (filters?.year && SecurityValidator.isValidAcademicData(filters.year, filters.semester || 1)) {
      query = query.eq('year', filters.year);
    }
    if (filters?.semester && SecurityValidator.isValidAcademicData(filters.year || 1, filters.semester)) {
      query = query.eq('semester', filters.semester);
    }
    if (filters?.status && ['ACTIVE', 'YD', 'PASSOUT'].includes(filters.status)) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) {
      SecureLogger.logError(error, 'getStudents');
      throw new Error('Failed to fetch students');
    }
    return data as Student[];
  } catch (error) {
    SecureLogger.logError(error, 'getStudents');
    throw error;
  }
}

export async function getStudentById(id: string) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Student;
}

export async function createStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) {
  try {
    // Validate required fields
    if (!student.name || student.name.length < 2 || student.name.length > 100) {
      throw new Error('Invalid student name');
    }
    
    // Sanitize inputs
    const sanitizedStudent = {
      ...student,
      name: SecurityValidator.sanitizeString(student.name),
      enrollment_no: student.enrollment_no ? SecurityValidator.sanitizeString(student.enrollment_no) : null,
      division: student.division ? SecurityValidator.sanitizeString(student.division) : null,
      department: student.department ? SecurityValidator.sanitizeString(student.department) : null,
      mobile: student.mobile && SecurityValidator.isValidPhone(student.mobile) ? student.mobile : null,
      email: student.email && SecurityValidator.isValidEmail(student.email) ? student.email : null
    };

    // Validate academic data
    if (!SecurityValidator.isValidAcademicData(sanitizedStudent.year, sanitizedStudent.semester)) {
      throw new Error('Invalid academic year/semester');
    }

    // Check for duplicate enrollment number
    if (sanitizedStudent.enrollment_no) {
      const { data: existingByEnrollment } = await supabase
        .from('students')
        .select('id')
        .ilike('enrollment_no', sanitizedStudent.enrollment_no)
        .maybeSingle();

      if (existingByEnrollment) {
        throw new Error(`Student with enrollment number "${sanitizedStudent.enrollment_no}" already exists`);
      }
    }

    const { data, error } = await supabase
      .from('students')
      .insert(sanitizedStudent)
      .select()
      .single();

    if (error) {
      SecureLogger.logError(error, 'createStudent');
      throw new Error('Failed to create student');
    }
    return data;
  } catch (error) {
    SecureLogger.logError(error, 'createStudent');
    throw error;
  }
}

export async function updateStudent(id: string, updates: Partial<Student>) {
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function bulkCreateStudents(students: Omit<Student, 'id' | 'created_at' | 'updated_at'>[]) {
  // Use regular insert since enrollment_no might not have a unique constraint
  // Filter out students that might already exist based on enrollment_no
  const { data, error } = await supabase
    .from('students')
    .insert(students)
    .select();

  if (error) {
    // If there's a duplicate key error, try inserting one by one
    if (error.code === '23505') {
      const results = [];
      for (const student of students) {
        try {
          const { data: singleData, error: singleError } = await supabase
            .from('students')
            .insert(student)
            .select()
            .single();
          if (!singleError && singleData) {
            results.push(singleData);
          }
        } catch {
          // Skip duplicates
        }
      }
      return results;
    }
    throw error;
  }
  return data;
}

export async function deleteStudent(id: string) {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function getStudentCount() {
  const { count, error } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ACTIVE');

  if (error) throw error;
  return count || 0;
}
