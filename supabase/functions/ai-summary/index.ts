import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AISummaryRequest {
  month: string; // Format: YYYY-MM
  class_id?: string;
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

    const body: AISummaryRequest = await req.json();
    
    // Validate input
    if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
      return new Response(
        JSON.stringify({ error: 'Invalid month format. Expected YYYY-MM' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { month, class_id } = body;
    console.log(`Generating AI summary for ${month}${class_id ? `, class: ${class_id}` : ''}`);

    // Calculate date range for the month
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${month}-01`;
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]; // Last day of month

    // Fetch attendance statistics
    let sessionsQuery = supabase
      .from('attendance_sessions')
      .select(`
        id, date, class_id,
        classes (name, division)
      `)
      .gte('date', startDate)
      .lte('date', endDate);

    if (class_id) {
      sessionsQuery = sessionsQuery.eq('class_id', class_id);
    }

    const { data: sessions } = await sessionsQuery;
    const totalSessions = sessions?.length || 0;

    // Get attendance records
    const sessionIds = sessions?.map(s => s.id) || [];
    let totalPresent = 0;
    let totalRecords = 0;

    if (sessionIds.length > 0) {
      const { data: records } = await supabase
        .from('attendance_records')
        .select('status')
        .in('session_id', sessionIds);

      totalRecords = records?.length || 0;
      totalPresent = records?.filter(r => r.status === 'PRESENT').length || 0;
    }

    const avgAttendance = totalRecords > 0 
      ? Math.round((totalPresent / totalRecords) * 100) 
      : 0;

    // Get class-wise breakdown
    const classStats: Record<string, { sessions: number; avgAttendance: number }> = {};
    
    if (sessions) {
      const classGroups = new Map<string, { sessions: { id: string }[]; className: string }>();
      
      sessions.forEach(session => {
        const classId = session.class_id;
        const classData = session as Record<string, unknown>;
        const classes = classData.classes as Record<string, unknown> | null;
        const className = `${classes?.name || ''} ${classes?.division || ''}`.trim();
        
        if (!classGroups.has(classId)) {
          classGroups.set(classId, { sessions: [], className });
        }
        classGroups.get(classId)!.sessions.push({ id: session.id });
      });

      for (const [, data] of classGroups) {
        const classSessionIds = data.sessions.map(s => s.id);
        const { data: classRecords } = await supabase
          .from('attendance_records')
          .select('status')
          .in('session_id', classSessionIds);

        const present = classRecords?.filter(r => r.status === 'PRESENT').length || 0;
        const total = classRecords?.length || 0;

        classStats[data.className] = {
          sessions: data.sessions.length,
          avgAttendance: total > 0 ? Math.round((present / total) * 100) : 0,
        };
      }
    }

    // Get defaulter count (below 75%)
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('status', 'ACTIVE');

    let defaulterCount = 0;
    const threshold = 75;

    if (students && sessionIds.length > 0) {
      for (const student of students) {
        const { data: studentRecords } = await supabase
          .from('attendance_records')
          .select('status')
          .eq('student_id', student.id)
          .in('session_id', sessionIds);

        if (studentRecords && studentRecords.length > 0) {
          const present = studentRecords.filter(r => r.status === 'PRESENT').length;
          const percentage = (present / studentRecords.length) * 100;
          if (percentage < threshold) {
            defaulterCount++;
          }
        }
      }
    }

    // Generate summary text
    const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long' });
    
    // Find best and worst classes
    const classesSorted = Object.entries(classStats).sort((a, b) => b[1].avgAttendance - a[1].avgAttendance);
    const bestClass = classesSorted[0];
    const worstClass = classesSorted[classesSorted.length - 1];

    let summary = `Monthly Summary for ${monthName} ${year}:\n\n`;
    summary += `A total of ${totalSessions} attendance sessions were conducted during this month, `;
    summary += `with an overall average attendance of ${avgAttendance}%. `;
    
    if (bestClass && worstClass && bestClass[0] !== worstClass[0]) {
      summary += `${bestClass[0]} showed the highest attendance at ${bestClass[1].avgAttendance}%, `;
      summary += `while ${worstClass[0]} had the lowest at ${worstClass[1].avgAttendance}%. `;
    }
    
    summary += `\n\nThere are currently ${defaulterCount} students below the ${threshold}% attendance threshold `;
    summary += `who require attention and counseling. `;
    
    if (avgAttendance >= 85) {
      summary += `Overall attendance performance is excellent. Keep up the good work!`;
    } else if (avgAttendance >= 75) {
      summary += `Attendance performance is satisfactory but there's room for improvement.`;
    } else {
      summary += `Attendance performance needs immediate attention. Consider implementing measures to improve student attendance.`;
    }

    // Insert into activity log
    const { data: logEntry, error: logError } = await supabase
      .from('activity_log')
      .insert({
        message: `AI Summary (${month}): ${summary.substring(0, 200)}...`,
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Error creating activity log:', logError);
    }

    console.log(`Summary generated: ${summary.substring(0, 100)}...`);

    return new Response(
      JSON.stringify({ 
        month,
        summary,
        stats: {
          totalSessions,
          avgAttendance,
          defaulterCount,
          classStats,
        },
        activity_log_id: logEntry?.id || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-summary function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
