import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AssignSubstituteRequest {
  faculty_id: string;
  date: string;
  window: 'FULL_DAY' | 'HALF_MORNING' | 'HALF_AFTERNOON';
}

interface AssignmentResult {
  slot_id: string;
  sub_faculty_id: string;
  sub_faculty_name?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AssignSubstituteRequest = await req.json();
    
    // Validate input
    if (!body.faculty_id || !body.date || !body.window) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: faculty_id, date, window' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { faculty_id, date, window: leaveWindow } = body;
    console.log(`Processing substitute assignment for faculty ${faculty_id} on ${date}, window: ${leaveWindow}`);

    // Get day of week from date
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[new Date(date).getDay()];

    // Fetch affected timetable slots for the faculty on that day
    let slotsQuery = supabase
      .from('timetable_slots')
      .select(`
        id, start_time, class_id, subject_id, room_no,
        classes (id, name, division),
        subjects (id, name, subject_code)
      `)
      .eq('faculty_id', faculty_id)
      .eq('day_of_week', dayOfWeek)
      .lte('valid_from', date)
      .gte('valid_to', date);

    // Filter by time window
    if (leaveWindow === 'HALF_MORNING') {
      slotsQuery = slotsQuery.lt('start_time', '12:30:00');
    } else if (leaveWindow === 'HALF_AFTERNOON') {
      slotsQuery = slotsQuery.gte('start_time', '12:30:00');
    }

    const { data: affectedSlots, error: slotsError } = await slotsQuery;

    if (slotsError) {
      console.error('Error fetching slots:', slotsError);
      throw slotsError;
    }

    if (!affectedSlots || affectedSlots.length === 0) {
      return new Response(
        JSON.stringify({ assigned: [], skipped: [], message: 'No slots found for the given criteria' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${affectedSlots.length} affected slots`);

    const assigned: AssignmentResult[] = [];
    const skipped: string[] = [];

    // Get all faculty for potential substitutes
    const { data: allFaculty } = await supabase
      .from('faculty')
      .select(`
        id, department,
        profiles (name)
      `)
      .eq('status', 'Active')
      .neq('id', faculty_id);

    for (const slot of affectedSlots) {
      // Find faculty who are free at this time
      const { data: busyFaculty } = await supabase
        .from('timetable_slots')
        .select('faculty_id')
        .eq('day_of_week', dayOfWeek)
        .eq('start_time', slot.start_time)
        .lte('valid_from', date)
        .gte('valid_to', date);

      const busyFacultyIds = new Set(busyFaculty?.map(f => f.faculty_id) || []);
      
      // Filter available faculty
      const availableFaculty = allFaculty?.filter(f => !busyFacultyIds.has(f.id)) || [];

      if (availableFaculty.length === 0) {
        skipped.push(slot.id);
        console.log(`No available substitute for slot ${slot.id}`);
        continue;
      }

      // Get subject allocations to prefer faculty who teach the same subject
      const { data: subjectAllocations } = await supabase
        .from('subject_allocations')
        .select('faculty_id')
        .eq('subject_id', slot.subject_id);

      const sameSubjectFacultyIds = new Set(subjectAllocations?.map(a => a.faculty_id) || []);

      // Priority: same subject > same department > any available
      let selectedFaculty = availableFaculty.find(f => sameSubjectFacultyIds.has(f.id));
      
      if (!selectedFaculty) {
        // Try same department
        const { data: originalFaculty } = await supabase
          .from('faculty')
          .select('department')
          .eq('id', faculty_id)
          .single();

        if (originalFaculty?.department) {
          selectedFaculty = availableFaculty.find(f => f.department === originalFaculty.department);
        }
      }

      if (!selectedFaculty) {
        // Pick first available
        selectedFaculty = availableFaculty[0];
      }

      if (selectedFaculty) {
        // Create substitution assignment
        const { error: insertError } = await supabase
          .from('substitution_assignments')
          .insert({
            src_faculty_id: faculty_id,
            sub_faculty_id: selectedFaculty.id,
            class_id: slot.class_id,
            subject_id: slot.subject_id,
            date: date,
            start_time: slot.start_time,
          });

        if (insertError) {
          console.error('Error creating substitution:', insertError);
          skipped.push(slot.id);
          continue;
        }

        // Log activity
        const subFacultyName = (selectedFaculty as Record<string, unknown>).profiles 
          ? ((selectedFaculty as Record<string, unknown>).profiles as Record<string, unknown>)?.name as string || 'Unknown'
          : 'Unknown';
        const className = (slot as Record<string, unknown>).classes 
          ? ((slot as Record<string, unknown>).classes as Record<string, unknown>)?.name as string || ''
          : '';
        const subjectName = (slot as Record<string, unknown>).subjects 
          ? ((slot as Record<string, unknown>).subjects as Record<string, unknown>)?.name as string || ''
          : '';

        await supabase.from('activity_log').insert({
          message: `Assigned substitute Prof. ${subFacultyName} for ${className} ${subjectName} on ${date} at ${slot.start_time}`,
        });

        assigned.push({
          slot_id: slot.id,
          sub_faculty_id: selectedFaculty.id,
          sub_faculty_name: subFacultyName,
        });

        console.log(`Assigned ${subFacultyName} as substitute for slot ${slot.id}`);
      } else {
        skipped.push(slot.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        assigned, 
        skipped,
        message: `Assigned ${assigned.length} substitutes, skipped ${skipped.length} slots`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in assign-substitute function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
