import { supabase } from '@/integrations/supabase/client';
import { SecurityValidator, SecureLogger } from '@/utils/security';

export interface Batch {
    id: string;
    name: string;
    class_id: string;
    created_at?: string;
}

export interface BatchStudent {
    batch_id: string;
    student_id: string;
}

// SQL to create these tables:
/*
create table batches (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  class_id uuid references classes(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table student_batches (
  batch_id uuid references batches(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  primary key (batch_id, student_id)
);
*/

export async function getBatches(classId: string) {
    try {
        if (!SecurityValidator.isValidUUID(classId)) {
            throw new Error('Invalid class ID format');
        }
        
        const { data, error } = await supabase
            .from('batches')
            .select('*')
            .eq('class_id', classId)
            .order('name');

        if (error) {
            SecureLogger.logError(error, 'getBatches');
            throw new Error('Failed to fetch batches');
        }
        return data as Batch[];
    } catch (error) {
        SecureLogger.logError(error, 'getBatches');
        throw error;
    }
}

export async function createBatch(name: string, classId: string, studentIds: string[]) {
    try {
        // Input validation
        if (!name || name.length < 1 || name.length > 50) {
            throw new Error('Batch name must be between 1 and 50 characters');
        }
        
        if (!SecurityValidator.isValidUUID(classId)) {
            throw new Error('Invalid class ID format');
        }
        
        if (!studentIds.length || studentIds.length > 100) {
            throw new Error('Student count must be between 1 and 100');
        }
        
        // Validate all student IDs are proper UUIDs
        const invalidStudentIds = studentIds.filter(id => !SecurityValidator.isValidUUID(id));
        if (invalidStudentIds.length > 0) {
            SecureLogger.logSuspiciousActivity('Invalid student IDs in batch creation', invalidStudentIds);
            throw new Error('Invalid student ID format detected');
        }
        
        // Sanitize batch name
        const sanitizedName = SecurityValidator.sanitizeString(name);
        
        // Check for duplicate batch name in same class (case-insensitive)
        const { data: existing } = await supabase
            .from('batches')
            .select('id, name')
            .eq('class_id', classId)
            .ilike('name', sanitizedName);

        if (existing && existing.length > 0) {
            throw new Error(`Batch "${sanitizedName}" already exists in this class`);
        }

        // Verify class exists before creating batch
        const { data: classExists } = await supabase
            .from('classes')
            .select('id')
            .eq('id', classId)
            .single();
            
        if (!classExists) {
            throw new Error('Class not found');
        }

        // 1. Create Batch with transaction-like behavior
        const { data: batch, error: batchError } = await supabase
            .from('batches')
            .insert({ name: sanitizedName, class_id: classId })
            .select()
            .single();

        if (batchError) {
            SecureLogger.logError(batchError, 'createBatch - batch creation');
            throw new Error('Failed to create batch');
        }

        // 2. Verify students exist and belong to the same class
        const { data: validStudents } = await supabase
            .from('students')
            .select('id, class_id')
            .in('id', studentIds)
            .eq('class_id', classId);
            
        if (!validStudents || validStudents.length !== studentIds.length) {
            // Cleanup: delete the created batch
            await supabase.from('batches').delete().eq('id', batch.id);
            throw new Error('Some students not found or do not belong to this class');
        }

        // 3. Add Students to Batch
        const studentBatchData = studentIds.map(studentId => ({
            batch_id: batch.id,
            student_id: studentId
        }));

        const { error: studentsError } = await supabase
            .from('student_batches')
            .insert(studentBatchData);

        if (studentsError) {
            // Cleanup: delete the created batch
            await supabase.from('batches').delete().eq('id', batch.id);
            SecureLogger.logError(studentsError, 'createBatch - student assignment');
            throw new Error('Failed to assign students to batch');
        }

        return batch;
    } catch (error) {
        SecureLogger.logError(error, 'createBatch');
        throw error;
    }
}

export async function deleteBatch(batchId: string) {
    const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', batchId);

    if (error) throw error;
}

export async function getBatchStudents(batchId: string) {
    const { data, error } = await supabase
        .from('student_batches')
        .select('student_id')
        .eq('batch_id', batchId);

    if (error) throw error;
    return data.map(d => d.student_id);
}
