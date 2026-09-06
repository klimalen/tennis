-- Allows authenticated users to delete their own account
-- SECURITY DEFINER runs as postgres (superuser), so it can delete from auth.users
CREATE OR REPLACE FUNCTION delete_current_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
