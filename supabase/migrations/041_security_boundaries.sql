-- Close the gaps where the browser could bypass the API.
-- Policies are the real boundary: the anon key can call Postgres directly.

-- ─── Games: only the creator adds players; joining an open game is a locked function ───

DROP POLICY IF EXISTS "Creator can insert participants" ON game_participants;
CREATE POLICY "Creator can insert participants"
  ON game_participants FOR INSERT
  WITH CHECK (game_id IN (SELECT my_created_game_ids()));

DROP POLICY IF EXISTS "Participants can update game" ON games;

CREATE OR REPLACE FUNCTION join_open_game(p_game_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_game
  FROM games
  WHERE id = p_game_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_game.is_open THEN
    RAISE EXCEPTION 'game not open';
  END IF;

  IF EXISTS (
    SELECT 1 FROM game_participants
    WHERE game_id = p_game_id AND player_id = auth.uid()
  ) THEN
    RETURN 'already';
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

-- ─── Chats: clients cannot insert themselves into a conversation ────────────
-- get_or_create_conversation is SECURITY DEFINER and remains the only writer.

DROP POLICY IF EXISTS "System creates conversations" ON conversations;
DROP POLICY IF EXISTS "System inserts participants" ON conversation_participants;

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
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = other_user_id
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  v_conv_id := gen_random_uuid();
  INSERT INTO conversations (id) VALUES (v_conv_id);
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES
    (v_conv_id, auth.uid()),
    (v_conv_id, other_user_id);

  RETURN v_conv_id;
END;
$$;

REVOKE ALL ON FUNCTION get_or_create_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_or_create_conversation(uuid) TO authenticated;

REVOKE ALL ON FUNCTION delete_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_current_user() TO authenticated;

-- A request's two players stay fixed. Status changes still go through the existing policy.
CREATE OR REPLACE FUNCTION game_requests_freeze_parties()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sender_id := OLD.sender_id;
  NEW.receiver_id := OLD.receiver_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_requests_freeze_parties ON game_requests;
CREATE TRIGGER game_requests_freeze_parties
  BEFORE UPDATE ON game_requests
  FOR EACH ROW EXECUTE FUNCTION game_requests_freeze_parties();

-- ─── Venues: the catalog is read-only for the app ───────────────────────────
-- Ingest scripts use the service role, which bypasses RLS.

DROP POLICY IF EXISTS "Venues upsertable by service role" ON venues;

-- ─── Profiles: public fields stay readable; secrets and flags do not move ───

REVOKE SELECT (stripe_customer_id, birth_year, gender, location)
  ON public.profiles FROM anon, authenticated;

REVOKE UPDATE (
  stripe_customer_id,
  birth_year,
  gender,
  location,
  skill_level_computed,
  skill_level_verified_by,
  is_coach,
  is_club_manager,
  reliability_score,
  total_matches,
  identity_verified,
  deleted_at,
  created_at,
  last_active_at
) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION profiles_keep_system_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.role() IS NULL
     AND current_user IS DISTINCT FROM 'authenticated'
     AND current_user IS DISTINCT FROM 'anon' THEN
    RETURN NEW;
  END IF;

  NEW.skill_level_computed := OLD.skill_level_computed;
  NEW.skill_level_verified_by := OLD.skill_level_verified_by;
  NEW.is_coach := OLD.is_coach;
  NEW.is_club_manager := OLD.is_club_manager;
  NEW.reliability_score := OLD.reliability_score;
  NEW.total_matches := OLD.total_matches;
  NEW.identity_verified := OLD.identity_verified;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.birth_year := OLD.birth_year;
  NEW.gender := OLD.gender;
  NEW.location := OLD.location;
  NEW.deleted_at := OLD.deleted_at;
  NEW.created_at := OLD.created_at;
  NEW.last_active_at := OLD.last_active_at;
  NEW.id := OLD.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_keep_system_columns ON profiles;
CREATE TRIGGER profiles_keep_system_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_keep_system_columns();

-- ─── Post photos live in the author's own folder, and stay small ────────────

DROP POLICY IF EXISTS "post_images_authenticated_insert" ON storage.objects;
CREATE POLICY "post_images_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'post-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('avatars', 'post-images');

-- ─── Notifications: one row per edit, and drop anything older than 90 days ──

CREATE OR REPLACE FUNCTION add_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_kind text,
  p_game_id uuid,
  p_payload jsonb,
  p_created_at timestamptz,
  p_source_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_actor_id IS NULL OR p_user_id = p_actor_id THEN
    RETURN;
  END IF;

  INSERT INTO notifications (user_id, actor_id, kind, game_id, payload, created_at, source_key)
  VALUES (
    p_user_id,
    p_actor_id,
    p_kind,
    p_game_id,
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_created_at, now()),
    p_source_key
  )
  ON CONFLICT (user_id, source_key) DO UPDATE
  SET
    payload = EXCLUDED.payload,
    created_at = EXCLUDED.created_at,
    actor_id = EXCLUDED.actor_id,
    kind = EXCLUDED.kind,
    game_id = EXCLUDED.game_id
  WHERE notifications.kind = 'game_updated';

  DELETE FROM notifications
  WHERE user_id = p_user_id
    AND created_at < now() - interval '90 days';
END;
$$;

REVOKE ALL ON FUNCTION add_notification(uuid, uuid, text, uuid, jsonb, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION add_notification(uuid, uuid, text, uuid, jsonb, timestamptz, text) TO postgres;

CREATE OR REPLACE FUNCTION notify_on_game_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_player uuid;
BEGIN
  IF NEW.scheduled_at IS NOT DISTINCT FROM OLD.scheduled_at
     AND NEW.format IS NOT DISTINCT FROM OLD.format
     AND NEW.neighborhood IS NOT DISTINCT FROM OLD.neighborhood THEN
    RETURN NEW;
  END IF;

  v_actor := COALESCE(auth.uid(), NEW.creator_id);

  FOR v_player IN
    SELECT player_id
    FROM game_participants
    WHERE game_id = NEW.id
      AND status IN ('accepted', 'invited')
      AND player_id <> v_actor
  LOOP
    PERFORM add_notification(
      v_player,
      v_actor,
      'game_updated',
      NEW.id,
      notification_game_payload(NEW),
      now(),
      'updated:' || NEW.id::text || ':' || v_player::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- ─── Deleting an account must not get stuck on unused booking rows ──────────

ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_owner_id_fkey;
ALTER TABLE clubs
  ADD CONSTRAINT clubs_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE court_bookings DROP CONSTRAINT IF EXISTS court_bookings_booked_by_fkey;
ALTER TABLE court_bookings
  ADD CONSTRAINT court_bookings_booked_by_fkey
  FOREIGN KEY (booked_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE booking_splits DROP CONSTRAINT IF EXISTS booking_splits_player_id_fkey;
ALTER TABLE booking_splits
  ADD CONSTRAINT booking_splits_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_skill_level_verified_by_fkey;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_skill_level_verified_by_fkey
  FOREIGN KEY (skill_level_verified_by) REFERENCES profiles(id) ON DELETE SET NULL;
