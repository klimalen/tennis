-- Private games (is_open = false) stay out of Open Games and invite-only for join,
-- but should still appear on the player's public profile / schedule for visitors.
-- Drafts remain creator-only; participants keep access to games they sit in.

DROP POLICY IF EXISTS "Open games viewable by everyone" ON games;
CREATE POLICY "Published games viewable by everyone"
  ON games FOR SELECT USING (
    status IS DISTINCT FROM 'draft'
    OR auth.uid() = creator_id
    OR id IN (SELECT my_game_ids())
  );

COMMENT ON POLICY "Published games viewable by everyone" ON games IS
  'Non-draft games (including private) are readable for profile schedules; join/open-games still gate on is_open.';
