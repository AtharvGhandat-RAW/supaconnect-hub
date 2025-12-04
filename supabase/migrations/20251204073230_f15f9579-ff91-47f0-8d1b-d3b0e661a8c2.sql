-- Fix the recursive admin policy by using the existing is_admin() function
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Add RLS policies for other essential tables

-- Faculty table policies
CREATE POLICY "Users can read own faculty record"
ON public.faculty
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Admins can read all faculty"
ON public.faculty
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can manage faculty"
ON public.faculty
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Classes policies
CREATE POLICY "Authenticated users can read classes"
ON public.classes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage classes"
ON public.classes
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Students policies
CREATE POLICY "Authenticated users can read students"
ON public.students
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage students"
ON public.students
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Subjects policies
CREATE POLICY "Authenticated users can read subjects"
ON public.subjects
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage subjects"
ON public.subjects
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Subject allocations policies
CREATE POLICY "Authenticated users can read allocations"
ON public.subject_allocations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage allocations"
ON public.subject_allocations
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Timetable slots policies
CREATE POLICY "Authenticated users can read timetable"
ON public.timetable_slots
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage timetable"
ON public.timetable_slots
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Attendance sessions policies
CREATE POLICY "Faculty can read own sessions"
ON public.attendance_sessions
FOR SELECT
TO authenticated
USING (
  faculty_id IN (SELECT id FROM faculty WHERE profile_id = auth.uid())
  OR public.is_admin()
);

CREATE POLICY "Faculty can create sessions"
ON public.attendance_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  faculty_id IN (SELECT id FROM faculty WHERE profile_id = auth.uid())
  OR public.is_admin()
);

CREATE POLICY "Admins can manage sessions"
ON public.attendance_sessions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Attendance records policies
CREATE POLICY "Faculty can manage attendance records"
ON public.attendance_records
FOR ALL
TO authenticated
USING (
  session_id IN (
    SELECT id FROM attendance_sessions 
    WHERE faculty_id IN (SELECT id FROM faculty WHERE profile_id = auth.uid())
  )
  OR public.is_admin()
)
WITH CHECK (
  session_id IN (
    SELECT id FROM attendance_sessions 
    WHERE faculty_id IN (SELECT id FROM faculty WHERE profile_id = auth.uid())
  )
  OR public.is_admin()
);

-- Faculty leaves policies
CREATE POLICY "Faculty can read own leaves"
ON public.faculty_leaves
FOR SELECT
TO authenticated
USING (
  faculty_id IN (SELECT id FROM faculty WHERE profile_id = auth.uid())
  OR public.is_admin()
);

CREATE POLICY "Faculty can create leaves"
ON public.faculty_leaves
FOR INSERT
TO authenticated
WITH CHECK (
  faculty_id IN (SELECT id FROM faculty WHERE profile_id = auth.uid())
);

CREATE POLICY "Admins can manage leaves"
ON public.faculty_leaves
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Substitution assignments policies
CREATE POLICY "Authenticated can read substitutions"
ON public.substitution_assignments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage substitutions"
ON public.substitution_assignments
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Syllabus topics policies
CREATE POLICY "Authenticated can read topics"
ON public.syllabus_topics
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Faculty can manage topics"
ON public.syllabus_topics
FOR ALL
TO authenticated
USING (public.is_faculty() OR public.is_admin())
WITH CHECK (public.is_faculty() OR public.is_admin());

-- Syllabus coverage policies
CREATE POLICY "Authenticated can read coverage"
ON public.syllabus_coverage
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Faculty can manage coverage"
ON public.syllabus_coverage
FOR ALL
TO authenticated
USING (public.is_faculty() OR public.is_admin())
WITH CHECK (public.is_faculty() OR public.is_admin());

-- Activity log policies
CREATE POLICY "Authenticated can read activity"
ON public.activity_log
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert activity"
ON public.activity_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Settings policies
CREATE POLICY "Authenticated can read settings"
ON public.settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage settings"
ON public.settings
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());