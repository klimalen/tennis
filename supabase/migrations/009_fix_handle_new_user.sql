-- Fix handle_new_user trigger to guarantee unique usernames
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username text;
  final_username text;
  counter int := 0;
BEGIN
  -- Build base username from email prefix, strip non-alphanumeric chars
  base_username := regexp_replace(
    split_part(COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), '@', 1),
    '[^a-zA-Z0-9_]', '', 'g'
  );

  -- Fallback if empty after stripping
  IF base_username IS NULL OR length(base_username) = 0 THEN
    base_username := 'player';
  END IF;

  -- Enforce max length
  base_username := left(base_username, 20);

  final_username := base_username;

  -- Increment suffix until unique
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;

  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
