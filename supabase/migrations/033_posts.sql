-- ─── Posts ────────────────────────────────────────────────────────────────────

CREATE TABLE posts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type             text        NOT NULL DEFAULT 'manual'
                               CHECK (type IN ('manual', 'match_result', 'open_game')),
  body             text,
  image_url        text,
  match_result_id  uuid        REFERENCES match_results(id) ON DELETE CASCADE,
  game_id          uuid        REFERENCES games(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX posts_author_created_idx ON posts(author_id, created_at DESC);
CREATE INDEX posts_created_at_idx     ON posts(created_at DESC);
CREATE INDEX posts_game_id_idx        ON posts(game_id);
CREATE INDEX posts_match_result_id_idx ON posts(match_result_id);

-- ─── Post likes ───────────────────────────────────────────────────────────────

CREATE TABLE post_likes (
  post_id    uuid        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX post_likes_user_idx ON post_likes(user_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- Posts: public read
CREATE POLICY "posts_select_all"  ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_own"  ON posts FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "posts_update_own"  ON posts FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "posts_delete_own"  ON posts FOR DELETE USING (author_id = auth.uid());

-- Likes: public read, own write
CREATE POLICY "post_likes_select_all"  ON post_likes FOR SELECT USING (true);
CREATE POLICY "post_likes_insert_own"  ON post_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "post_likes_delete_own"  ON post_likes FOR DELETE USING (user_id = auth.uid());

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION posts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION posts_set_updated_at();

-- ─── Auto-post: match result confirmed ────────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_post_match_result()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    INSERT INTO posts (author_id, type, match_result_id, game_id)
    VALUES (NEW.submitted_by, 'match_result', NEW.id, NEW.game_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER match_result_post_trigger
AFTER UPDATE ON match_results
FOR EACH ROW EXECUTE FUNCTION auto_post_match_result();

-- ─── Auto-post: open game created ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_post_open_game()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_open = true THEN
    INSERT INTO posts (author_id, type, game_id)
    VALUES (NEW.creator_id, 'open_game', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER open_game_post_trigger
AFTER INSERT ON games
FOR EACH ROW EXECUTE FUNCTION auto_post_open_game();

-- ─── Realtime ─────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE post_likes;

-- ─── Storage bucket for post images ──────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "post_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-images');

CREATE POLICY "post_images_authenticated_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "post_images_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
