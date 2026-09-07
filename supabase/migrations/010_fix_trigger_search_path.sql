-- Fix: SECURITY DEFINER functions in Supabase require explicit search_path
-- otherwise the function cannot resolve public schema tables

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
  counter int := 0;
BEGIN
  base_username := regexp_replace(
    split_part(COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), '@', 1),
    '[^a-zA-Z0-9_]', '', 'g'
  );

  IF base_username IS NULL OR length(base_username) = 0 THEN
    base_username := 'player';
  END IF;

  base_username := left(base_username, 20);
  final_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$;
