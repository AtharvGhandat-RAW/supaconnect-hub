import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateDefaulterRequest {
  class_id: string;
  from: string;
  to: string;
  threshold: number;
}

interface DefaulterStudent {
  student_id: string;
  roll_no: number | null;
  name: string;
  enrollment_no: string | null;
  present: number;
  total: number;
  percentage: number;
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

    const body: GenerateDefaulterRequest = await req.json();
    
    // Validate input
    if (!body.class_id || !body.from || !body.to) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: class_id, from, to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { class_id, from, to, threshold = 75 } = body;
    console.log(`Generating defaulters for class ${class_id} from ${from} to ${to}, threshold: ${threshold}%`);

    // Get all students in the class
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, roll_no, name, enrollment_no')
      .eq('class_id', class_id)
      .eq('status', 'ACTIVE')
      .order('roll_no', { ascending: true });

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      throw studentsError;
    }

    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ 
          class_id, 
          from, 
          to, 
          threshold, 
          defaulters: [],
          message: 'No active students found in this class'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all sessions for this class in the date range
    const { data: sessions, error: sessionsError } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('class_id', class_id)
      .gte('date', from)
      .lte('date', to);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw sessionsError;
    }

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ 
          class_id, 
          from, 
          to, 
          threshold, 
          defaulters: [],
          total_sessions: 0,
          message: 'No attendance sessions found in the given date range'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionIds = sessions.map(s => s.id);
    console.log(`Found ${sessionIds.length} sessions`);

    // Get all attendance records for these sessions
    const { data: records, error: recordsError } = await supabase
      .from('attendance_records')
      .select('student_id, status')
      .in('session_id', sessionIds);

    if (recordsError) {
      console.error('Error fetching records:', recordsError);
      throw recordsError;
    }

    // Compute attendance per student
    const studentAttendance = new Map<string, { present: number; total: number }>();
    
    // Initialize all students
    students.forEach(student => {
      studentAttendance.set(student.id, { present: 0, total: 0 });
    });

    // Count attendance
    (records || []).forEach(record => {
      const current = studentAttendance.get(record.student_id);
      if (current) {
        current.total++;
        if (record.status === 'PRESENT') {
          current.present++;
        }
      }
    });

    // Calculate percentages and filter defaulters
    const defaulters: DefaulterStudent[] = [];
    
    students.forEach(student => {
      const attendance = studentAttendance.get(student.id);
      if (attendance && attendance.total > 0) {
        const percentage = Math.round((attendance.present / attendance.total) * 100 * 100) / 100;
        
        if (percentage < threshold) {
          defaulters.push({
            student_id: student.id,
            roll_no: student.roll_no,
            name: student.name,
            enrollment_no: student.enrollment_no,
            present: attendance.present,
            total: attendance.total,
            percentage,
          });
        }
      }
    });

    // Sort by percentage ascending
    defaulters.sort((a, b) => a.percentage - b.percentage);

    console.log(`Found ${defaulters.length} defaulters out of ${students.length} students`);

    return new Response(
      JSON.stringify({ 
        class_id, 
        from, 
        to, 
        threshold,
        total_students: students.length,
        total_sessions: sessions.length,
        defaulters,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-defaulter function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
