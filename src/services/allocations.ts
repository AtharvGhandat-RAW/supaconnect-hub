import { supabase } from '@/integrations/supabase/client';

export interface SubjectAllocation {
  id: string;
  faculty_id: string;
  class_id: string;
  subject_id: string;
  batch_id?: string | null;
  created_at: string;
  subjects?: {
    id: string;
    name: string;
    subject_code: string;
    semester: number;
    year: number;
    type: string;
  };
  classes?: {
    id: string;
    name: string;
    division: string;
  };
  batches?: {
    id: string;
    name: string;
  };
  faculty?: {
    id: string;
    profiles?: {
      name: string;
    };
  };
}

export async function getSubjectAllocations(facultyId?: string) {
  let query = supabase
    .from('subject_allocations')
    .select(`
      *,
      subjects (id, name, subject_code, semester, year, type),
      classes (id, name, division)
    `);

  if (facultyId) query = query.eq('faculty_id', facultyId);

  const { data, error } = await query;
  if (error) throw error;
  return data as SubjectAllocation[];
}

export async function getAllAllocationsWithFaculty() {
  // First try with batches relation
  const { data, error } = await supabase
    .from('subject_allocations')
    .select(`
      *,
      subjects (id, name, subject_code, semester, year, type),
      classes (id, name, division),
      faculty (id, profiles (name))
    `);

  if (error) throw error;
  
  // Try to fetch batch info separately if batch_id exists
  const allocationsWithBatches = await Promise.all(
    (data || []).map(async (alloc) => {
      if (alloc.batch_id) {
        try {
          const { data: batchData } = await supabase
            .from('batches')
            .select('id, name')
            .eq('id', alloc.batch_id)
            .single();
          return { ...alloc, batches: batchData };
        } catch {
          return alloc;
        }
      }
      return alloc;
    })
  );
  
  return allocationsWithBatches as SubjectAllocation[];
}

export async function createSubjectAllocation(allocation: {
  faculty_id: string;
  class_id: string;
  subject_id: string;
  batch_id?: string | null;
}) {
  // Check if this exact allocation already exists
  const { data: existing } = await supabase
    .from('subject_allocations')
    .select('id')
    .eq('faculty_id', allocation.faculty_id)
    .eq('class_id', allocation.class_id)
    .eq('subject_id', allocation.subject_id)
    .maybeSingle();

  if (existing) {
    throw new Error('This subject is already allocated to this faculty for this class');
  }

  // Also check if subject-class combo is already allocated to another faculty
  const { data: existingAlloc } = await supabase
    .from('subject_allocations')
    .select('id, faculty_id')
    .eq('class_id', allocation.class_id)
    .eq('subject_id', allocation.subject_id)
    .maybeSingle();

  if (existingAlloc && existingAlloc.faculty_id !== allocation.faculty_id) {
    throw new Error('This subject is already allocated to another faculty for this class');
  }

  if (existing) {
    throw new Error('This allocation already exists');
  }

  // Only include the core fields that definitely exist
  const insertData: Record<string, unknown> = {
    faculty_id: allocation.faculty_id,
    class_id: allocation.class_id,
    subject_id: allocation.subject_id,
  };

  // Try to include batch_id if provided - it will fail silently if column doesn't exist
  if (allocation.batch_id) {
    insertData.batch_id = allocation.batch_id;
  }

  const { data, error } = await supabase
    .from('subject_allocations')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    // If error is about batch_id column not existing, retry without it
    if (error.message?.includes('batch_id')) {
      const { data: retryData, error: retryError } = await supabase
        .from('subject_allocations')
        .insert({
          faculty_id: allocation.faculty_id,
          class_id: allocation.class_id,
          subject_id: allocation.subject_id,
        })
        .select()
        .single();
      if (retryError) throw retryError;
      return retryData;
    }
    throw error;
  }
  return data;
}

export async function deleteSubjectAllocation(id: string) {
  const { error } = await supabase
    .from('subject_allocations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Sync allocations from existing timetable slots
export async function syncAllocationsFromTimetable() {
  // Get all timetable slots
  const { data: slots, error: slotsError } = await supabase
    .from('timetable_slots')
    .select('faculty_id, class_id, subject_id, batch_id');

  if (slotsError) throw slotsError;

  // Get existing allocations
  const { data: existingAllocs } = await supabase
    .from('subject_allocations')
    .select('faculty_id, class_id, subject_id, batch_id');

  const existingSet = new Set(
    (existingAllocs || []).map(a => `${a.faculty_id}-${a.class_id}-${a.subject_id}-${a.batch_id || 'null'}`)
  );

  // Find unique combinations from timetable not in allocations
  const toCreate = new Map<string, { faculty_id: string; class_id: string; subject_id: string; batch_id?: string | null }>();
  (slots || []).forEach(slot => {
    const key = `${slot.faculty_id}-${slot.class_id}-${slot.subject_id}-${slot.batch_id || 'null'}`;
    if (!existingSet.has(key) && !toCreate.has(key)) {
      toCreate.set(key, {
        faculty_id: slot.faculty_id,
        class_id: slot.class_id,
        subject_id: slot.subject_id,
        batch_id: slot.batch_id || null,
      });
    }
  });

  // Insert new allocations
  if (toCreate.size > 0) {
    const { error } = await supabase
      .from('subject_allocations')
      .insert(Array.from(toCreate.values()));

    if (error) throw error;
  }

  return toCreate.size;
}
