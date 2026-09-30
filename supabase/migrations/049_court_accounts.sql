-- Court accounts: a facility logs in as a profile, not as a player.
-- The search card stays a catalog row. Linking is a separate manual step:
--   UPDATE venue_groups SET profile_id = '<profile uuid>' WHERE id = '<group uuid>';
-- profile_id is unique, so one profile belongs to one card and one card to one profile.

ALTER TABLE profiles
  ADD COLUMN account_kind text NOT NULL DEFAULT 'player'
    CHECK (account_kind IN ('player', 'court')),
  ADD COLUMN phone text,
  ADD COLUMN website text;

ALTER TABLE venue_groups
  ADD COLUMN profile_id uuid UNIQUE REFERENCES profiles(id) ON DELETE SET NULL;

-- Court sessions have no player-level range. Null means "not set".
ALTER TABLE games ALTER COLUMN skill_level_min DROP NOT NULL;
ALTER TABLE games ALTER COLUMN skill_level_max DROP NOT NULL;

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
  kind text;
  city_lat double precision;
  city_lng double precision;
BEGIN
  kind := COALESCE(NEW.raw_user_meta_data->>'account_kind', 'player');
  IF kind <> 'court' THEN
    kind := 'player';
  END IF;

  IF kind = 'court' THEN
    base_username := lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), '[^a-zA-Z0-9]', '', 'g'));
  ELSE
    base_username := regexp_replace(
      split_part(COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), '@', 1),
      '[^a-zA-Z0-9_]', '', 'g'
    );
  END IF;

  IF base_username IS NULL OR length(base_username) = 0 THEN
    base_username := CASE WHEN kind = 'court' THEN 'court' ELSE 'player' END;
  END IF;

  base_username := left(base_username, 20);
  final_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := left(base_username, 20 - length(counter::text)) || counter::text;
  END LOOP;

  BEGIN
    city_lat := NULLIF(NEW.raw_user_meta_data->>'city_lat', '')::double precision;
    city_lng := NULLIF(NEW.raw_user_meta_data->>'city_lng', '')::double precision;
  EXCEPTION WHEN OTHERS THEN
    city_lat := NULL;
    city_lng := NULL;
  END;

  INSERT INTO public.profiles (
    id, username, full_name, avatar_url, account_kind,
    phone, website, bio, city_name, city_lat, city_lng
  )
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    kind,
    NULLIF(left(COALESCE(NEW.raw_user_meta_data->>'phone', ''), 40), ''),
    NULLIF(left(COALESCE(NEW.raw_user_meta_data->>'website', ''), 300), ''),
    NULLIF(left(COALESCE(NEW.raw_user_meta_data->>'bio', ''), 600), ''),
    NULLIF(left(COALESCE(NEW.raw_user_meta_data->>'city_name', ''), 120), ''),
    city_lat,
    city_lng
  );

  RETURN NEW;
END;
$$;

-- A court cannot turn itself into a player, or fill player-only fields.
CREATE OR REPLACE FUNCTION protect_court_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.account_kind IS DISTINCT FROM OLD.account_kind THEN
    NEW.account_kind := OLD.account_kind;
  END IF;
  IF NEW.account_kind = 'court' THEN
    NEW.skill_level_self := NULL;
    NEW.skill_level_computed := NULL;
    NEW.looking_for := NULL;
    NEW.is_coach := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_court ON profiles;
CREATE TRIGGER profiles_protect_court
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_court_profile();

-- Opening a chat with a court does not follow either side.
CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  IF auth.uid() IS NULL OR other_user_id IS NULL OR other_user_id = auth.uid() THEN
    RAISE EXCEPTION 'invalid conversation';
  END IF;

  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(LEAST(auth.uid(), other_user_id)::text || GREATEST(auth.uid(), other_user_id)::text), 1, 16))::bit(64)::bigint
  );

  SELECT cp1.conversation_id INTO v_conv_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = other_user_id
    AND c.kind = 'direct'
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  v_conv_id := gen_random_uuid();
  INSERT INTO conversations (id, kind) VALUES (v_conv_id, 'direct');
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES
    (v_conv_id, auth.uid()),
    (v_conv_id, other_user_id);

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id IN (auth.uid(), other_user_id)
      AND account_kind = 'court'
  ) THEN
    INSERT INTO follows (follower_id, following_id) VALUES
      (auth.uid(), other_user_id),
      (other_user_id, auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_conv_id;
END;
$$;

REVOKE ALL ON FUNCTION get_or_create_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_or_create_conversation(uuid) TO authenticated;

-- A court organises games and never takes a seat.
CREATE OR REPLACE FUNCTION join_open_game(p_game_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_count int;
  v_status participant_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_kind = 'court') THEN
    RAISE EXCEPTION 'court cannot join';
  END IF;

  SELECT * INTO v_game
  FROM games
  WHERE id = p_game_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_game.is_open THEN
    RAISE EXCEPTION 'game not open';
  END IF;

  SELECT status INTO v_status
  FROM game_participants
  WHERE game_id = p_game_id AND player_id = auth.uid();

  IF FOUND THEN
    IF v_status = 'accepted' THEN
      RETURN 'already';
    END IF;

    SELECT count(*) INTO v_count
    FROM game_participants
    WHERE game_id = p_game_id
      AND status IN ('accepted', 'invited')
      AND player_id <> auth.uid();

    IF v_count >= v_game.max_players THEN
      RAISE EXCEPTION 'game full';
    END IF;

    UPDATE game_participants
    SET status = 'accepted', responded_at = now()
    WHERE game_id = p_game_id AND player_id = auth.uid();

    RETURN 'joined';
  END IF;

  SELECT count(*) INTO v_count
  FROM game_participants
  WHERE game_id = p_game_id
    AND status IN ('accepted', 'invited');

  IF v_count >= v_game.max_players THEN
    RAISE EXCEPTION 'game full';
  END IF;

  INSERT INTO game_participants (game_id, player_id, status)
  VALUES (p_game_id, auth.uid(), 'accepted');

  RETURN 'joined';
END;
$$;

REVOKE ALL ON FUNCTION join_open_game(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION join_open_game(uuid) TO authenticated;
