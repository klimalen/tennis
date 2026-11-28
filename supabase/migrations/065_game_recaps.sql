-- Game recap is a post (type game_recap), not a second entity.
-- Each player in a game has at most one. Its audience is independent of games.is_open.
-- Private recaps stay on the game. Friends recaps are mutual-follow only. Public recaps are world-readable.
-- Publishing one does not open the game: the card stores player ids, and the UI shows date + players
-- when the viewer cannot open the game.

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check;
ALTER TABLE posts
  ADD CONSTRAINT posts_type_check
  CHECK (type IN ('manual', 'match_result', 'open_game', 'game_recap'));

ALTER TABLE posts
  ADD COLUMN visibility text NOT NULL DEFAULT 'public'
  CONSTRAINT posts_visibility_check CHECK (visibility IN ('private', 'friends', 'public'));

ALTER TABLE posts
  ADD COLUMN recap_player_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN posts.visibility IS
  'Who can read the post. Existing post types stay public. A game recap chooses private, friends, or public on its own.';

COMMENT ON COLUMN posts.recap_player_ids IS
  'Players shown on a game recap card. Filled by posts_guard_game_recap so a viewer does not need access to the game roster.';

-- One open-game announcement and one recap can both point at the same game.
DROP INDEX IF EXISTS posts_author_game_unique;
CREATE UNIQUE INDEX posts_author_game_type_unique
  ON posts (author_id, game_id, type)
  WHERE game_id IS NOT NULL;

CREATE INDEX posts_game_recap_visibility_idx
  ON posts (author_id, created_at DESC)
  WHERE type = 'game_recap';

-- ─── Photos (a recap can have several; manual posts keep image_url) ───────────

CREATE TABLE post_media (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url        text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX post_media_post_idx ON post_media (post_id, sort_order);

ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_media_select_with_post"
  ON post_media FOR SELECT
  USING (EXISTS (SELECT 1 FROM posts WHERE posts.id = post_media.post_id));

CREATE POLICY "post_media_insert_own"
  ON post_media FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_id
        AND posts.author_id = auth.uid()
    )
  );

CREATE POLICY "post_media_update_own"
  ON post_media FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "post_media_delete_own"
  ON post_media FOR DELETE
  USING (author_id = auth.uid());

-- ─── Who can read a post ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "posts_select_all" ON posts;
CREATE POLICY "posts_select_visible"
  ON posts FOR SELECT
  USING (
    author_id = auth.uid()
    OR visibility = 'public'
    OR (
      visibility = 'friends'
      AND EXISTS (
        SELECT 1
        FROM follows outbound
        JOIN follows inbound
          ON inbound.follower_id = outbound.following_id
         AND inbound.following_id = outbound.follower_id
        WHERE outbound.follower_id = auth.uid()
          AND outbound.following_id = posts.author_id
      )
    )
  );

-- A like requires a post the liker is allowed to read.
DROP POLICY IF EXISTS "post_likes_insert_own" ON post_likes;
CREATE POLICY "post_likes_insert_own"
  ON post_likes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM posts WHERE posts.id = post_id)
  );

-- ─── Recap rules (the anon key can write posts directly) ──────────────────────

CREATE OR REPLACE FUNCTION posts_guard_game_recap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game games%ROWTYPE;
BEGIN
  IF NEW.type IS DISTINCT FROM 'game_recap' THEN
    IF TG_OP = 'UPDATE' AND OLD.type = 'game_recap' THEN
      RAISE EXCEPTION 'game recap type is fixed';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.type IS DISTINCT FROM 'game_recap' THEN
    RAISE EXCEPTION 'a post cannot become a game recap';
  END IF;

  IF NEW.game_id IS NULL THEN
    RAISE EXCEPTION 'game recap requires a game';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.game_id IS DISTINCT FROM NEW.game_id THEN
    RAISE EXCEPTION 'game recap stays on its game';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'game recap author is fixed';
  END IF;

  SELECT * INTO v_game FROM games WHERE id = NEW.game_id;
  IF NOT FOUND OR v_game.status = 'draft' THEN
    RAISE EXCEPTION 'game not found';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_game.status = 'cancelled' THEN
      RAISE EXCEPTION 'cancelled games cannot have a new recap';
    END IF;

    IF v_game.scheduled_at + (COALESCE(v_game.duration_minutes, 90) * INTERVAL '1 minute') > now() THEN
      RAISE EXCEPTION 'recap opens after the game ends';
    END IF;

    IF v_game.creator_id IS DISTINCT FROM NEW.author_id
       AND NOT EXISTS (
         SELECT 1 FROM game_participants gp
         WHERE gp.game_id = v_game.id
           AND gp.player_id = NEW.author_id
           AND gp.status IN ('accepted', 'invited')
       ) THEN
      RAISE EXCEPTION 'only people in the game can write a recap';
    END IF;
  END IF;

  -- Date stays on the game. Names and avatars are read from profiles, which are public.
  -- Court hosts are organisers, not players on the card.
  SELECT COALESCE(array_agg(player_id ORDER BY ord, player_id), '{}'::uuid[])
    INTO NEW.recap_player_ids
  FROM (
    SELECT p.id AS player_id, 0 AS ord
    FROM profiles p
    WHERE p.id = v_game.creator_id
      AND p.account_kind IS DISTINCT FROM 'court'
    UNION ALL
    SELECT p.id, 1
    FROM game_participants gp
    JOIN profiles p ON p.id = gp.player_id
    WHERE gp.game_id = v_game.id
      AND gp.player_id <> v_game.creator_id
      AND gp.status IN ('accepted', 'invited')
      AND p.account_kind IS DISTINCT FROM 'court'
  ) seats;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_guard_game_recap ON posts;
CREATE TRIGGER posts_guard_game_recap
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_guard_game_recap();

REVOKE ALL ON FUNCTION posts_guard_game_recap() FROM PUBLIC;

-- The participant announcement conflict target has to match the new unique index.
CREATE OR REPLACE FUNCTION auto_post_game_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' THEN
    IF NOT EXISTS (
      SELECT 1 FROM games WHERE id = NEW.game_id AND creator_id = NEW.player_id
    ) THEN
      INSERT INTO posts (author_id, type, game_id)
      VALUES (NEW.player_id, 'open_game', NEW.game_id)
      ON CONFLICT (author_id, game_id, type) WHERE game_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
