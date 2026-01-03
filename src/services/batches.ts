import { supabase } from '@/integrations/supabase/client';

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
    const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('class_id', classId)
        .order('name');

    if (error) throw error;
    return data as Batch[];
}

export async function createBatch(name: string, classId: string, studentIds: string[]) {
    // Check for duplicate batch name in same class
    const { data: existing } = await supabase
        .from('batches')
        .select('id')
        .eq('class_id', classId)
        .ilike('name', name)
        .maybeSingle();

    if (existing) {
        throw new Error(`Batch "${name}" already exists in this class`);
    }

    // 1. Create Batch
    const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({ name, class_id: classId })
        .select()
        .single();

    if (batchError) throw batchError;

    // 2. Add Students to Batch
    if (studentIds.length > 0) {
        const studentBatchData = studentIds.map(studentId => ({
            batch_id: batch.id,
            student_id: studentId
        }));

        const { error: studentsError } = await supabase
            .from('student_batches')
            .insert(studentBatchData);

        if (studentsError) throw studentsError;
    }

    return batch;
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
