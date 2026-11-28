-- Private, Friends, and Open replace the public/private boolean.
-- is_open stays in sync and is true only for Open, so older "city-wide" queries
-- do not start returning Friends games.
-- Existing private games stay private. Existing public games become open.

CREATE TYPE game_visibility AS ENUM ('private', 'friends', 'open');

ALTER TABLE games
  ADD COLUMN visibility game_visibility;

UPDATE games
SET visibility = CASE
  WHEN is_open THEN 'open'::game_visibility
  ELSE 'private'::game_visibility
END;

ALTER TABLE games
  ALTER COLUMN visibility SET NOT NULL;

-- Old inserts set is_open and omit visibility. New inserts set visibility.
-- Whichever field the writer changed is the one that wins.
CREATE OR REPLACE FUNCTION games_sync_visibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.visibility IS NULL THEN
      NEW.visibility := CASE
        WHEN COALESCE(NEW.is_open, false) THEN 'open'::game_visibility
        ELSE 'private'::game_visibility
      END;
    END IF;
    NEW.is_open := NEW.visibility = 'open';
  ELSIF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    NEW.is_open := NEW.visibility = 'open';
  ELSIF NEW.is_open IS DISTINCT FROM OLD.is_open THEN
    NEW.visibility := CASE
      WHEN NEW.is_open THEN 'open'::game_visibility
      ELSE 'private'::game_visibility
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER games_sync_visibility
BEFORE INSERT OR UPDATE OF visibility, is_open ON games
FOR EACH ROW EXECUTE FUNCTION games_sync_visibility();

CREATE INDEX games_visibility_scheduled_idx
  ON games (visibility, scheduled_at)
  WHERE status IS DISTINCT FROM 'draft';

-- Profile visitors no longer see every private game.
-- Open: anyone, including guests. Friends: mutual follows of the host, plus people already in it.
-- Private: host and people already in it.
DROP POLICY IF EXISTS "Published games viewable by everyone" ON games;
DROP POLICY IF EXISTS "Open games viewable by everyone" ON games;

CREATE POLICY "Games visible by access"
  ON games FOR SELECT
  USING (
    auth.uid() = creator_id
    OR id IN (SELECT my_game_ids())
    OR (
      status IS DISTINCT FROM 'draft'
      AND visibility = 'open'
    )
    OR (
      status IS DISTINCT FROM 'draft'
      AND visibility = 'friends'
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM follows outgoing
        WHERE outgoing.follower_id = auth.uid()
          AND outgoing.following_id = creator_id
      )
      AND EXISTS (
        SELECT 1 FROM follows incoming
        WHERE incoming.follower_id = creator_id
          AND incoming.following_id = auth.uid()
      )
    )
  );

COMMENT ON POLICY "Games visible by access" ON games IS
  'Open is public. Friends is mutual follows of the host. Private is the host and people already in the game.';

-- A friend who can see the game can see who is already in it.
CREATE POLICY "Roster visible with the game"
  ON game_participants FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM games WHERE games.id = game_participants.game_id)
  );

-- Self-join: Open for any player, Friends only for a mutual follow. Private stays invite-accept.
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
  v_existing boolean;
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

  IF NOT FOUND OR v_game.status IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'game not open';
  END IF;

  SELECT status INTO v_status
  FROM game_participants
  WHERE game_id = p_game_id AND player_id = auth.uid();
  v_existing := FOUND;

  IF v_existing AND v_status = 'accepted' THEN
    RETURN 'already';
  END IF;

  IF v_game.visibility = 'private' THEN
    RAISE EXCEPTION 'game not open';
  ELSIF v_game.visibility = 'friends' THEN
    IF NOT EXISTS (
      SELECT 1 FROM follows outgoing
      WHERE outgoing.follower_id = auth.uid()
        AND outgoing.following_id = v_game.creator_id
    ) OR NOT EXISTS (
      SELECT 1 FROM follows incoming
      WHERE incoming.follower_id = v_game.creator_id
        AND incoming.following_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'game not open';
    END IF;
  ELSIF v_game.visibility IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'game not open';
  END IF;

  IF v_existing THEN
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

-- Joining a private game must not announce it. Friends and Open still do.
CREATE OR REPLACE FUNCTION auto_post_game_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND EXISTS (
    SELECT 1 FROM games
    WHERE id = NEW.game_id
      AND creator_id <> NEW.player_id
      AND visibility IN ('open', 'friends')
      AND status IS DISTINCT FROM 'draft'
  ) THEN
    INSERT INTO posts (author_id, type, game_id)
    VALUES (NEW.player_id, 'open_game', NEW.game_id)
    ON CONFLICT (author_id, game_id) WHERE game_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Friends games get a feed post too. The feed query hides it from anyone who cannot read the game.
CREATE OR REPLACE FUNCTION auto_post_open_game()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.visibility IN ('open', 'friends') AND NEW.status IS DISTINCT FROM 'draft' THEN
    INSERT INTO posts (author_id, type, game_id)
    VALUES (NEW.creator_id, 'open_game', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION game_link_state(target uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN g.id IS NULL THEN 'gone'
    WHEN g.status = 'draft' THEN 'gone'
    WHEN g.visibility = 'open' THEN 'public'
    ELSE 'private'
  END
  FROM (SELECT target AS id) seed
  LEFT JOIN games g ON g.id = seed.id;
$$;
