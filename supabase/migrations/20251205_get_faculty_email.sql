-- Function to get all faculty with their emails
CREATE OR REPLACE FUNCTION public.get_all_faculty_with_email()
RETURNS TABLE (
  id uuid,
  name text,
  email varchar,
  employee_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, p.name, u.email::varchar, f.employee_code
  FROM public.faculty f
  JOIN public.profiles p ON f.profile_id = p.id
  JOIN auth.users u ON p.id = u.id;
END;
$$;
