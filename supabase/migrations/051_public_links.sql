-- Public share links.
-- Old usernames keep resolving until someone else claims them.
-- A game link can say public / private / gone without leaking private fields.
-- A catalog merge can point an old court id at the group that absorbed it.

CREATE TABLE profile_username_history (
  username text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  released_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profile_username_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION record_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NOT DISTINCT FROM OLD.username THEN
    RETURN NEW;
  END IF;

  -- The name is claimed again. Drop any leftover redirect.
  DELETE FROM profile_username_history WHERE username = NEW.username;

  IF OLD.username IS NOT NULL AND OLD.username IS DISTINCT FROM NEW.username THEN
    INSERT INTO profile_username_history (username, profile_id, released_at)
    VALUES (OLD.username, OLD.id, now())
    ON CONFLICT (username) DO UPDATE
      SET profile_id = EXCLUDED.profile_id,
          released_at = EXCLUDED.released_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_username_history ON profiles;
CREATE TRIGGER profiles_username_history
  BEFORE UPDATE OF username ON profiles
  FOR EACH ROW EXECUTE FUNCTION record_profile_username();

REVOKE ALL ON FUNCTION record_profile_username() FROM PUBLIC, anon, authenticated;

-- Current username of a living profile that used to wear this slug.
-- Null when the slug is unused, deleted, or already taken by someone else.
CREATE OR REPLACE FUNCTION profile_slug_redirect(slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.username
  FROM profile_username_history h
  JOIN profiles p ON p.id = h.profile_id
  WHERE h.username = slug
    AND p.deleted_at IS NULL
    AND p.username IS NOT NULL
    AND p.username <> slug
    AND NOT EXISTS (
      SELECT 1 FROM profiles cur
      WHERE cur.username = slug AND cur.deleted_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION profile_slug_redirect(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION profile_slug_redirect(text) TO anon, authenticated;

-- One word. Drafts look the same as a deleted game.
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
    WHEN g.is_open THEN 'public'
    ELSE 'private'
  END
  FROM (SELECT target AS id) seed
  LEFT JOIN games g ON g.id = seed.id;
$$;

REVOKE ALL ON FUNCTION game_link_state(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION game_link_state(uuid) TO anon, authenticated;

CREATE TABLE venue_group_redirects (
  old_id uuid PRIMARY KEY,
  new_id uuid NOT NULL REFERENCES venue_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (old_id <> new_id)
);

ALTER TABLE venue_group_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Court redirects are public"
  ON venue_group_redirects FOR SELECT
  USING (true);
