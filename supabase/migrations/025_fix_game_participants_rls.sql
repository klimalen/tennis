-- Fix infinite recursion in game_participants RLS policies.
--
-- Root cause chain:
--   game_participants INSERT policy
--     → queries games (with RLS)
--     → games SELECT policy queries game_participants (with RLS)
--     → infinite recursion
--
-- Solution: SECURITY DEFINER functions that bypass RLS,
-- same pattern as my_conversation_ids() / my_game_ids().

-- 1. Games created by the current user (bypasses RLS on games)
CREATE OR REPLACE FUNCTION my_created_game_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM games WHERE creator_id = auth.uid();
$$;

-- 2. Fix game_participants INSERT policy: replace games RLS lookup with fn
DROP POLICY IF EXISTS "Creator can insert participants" ON game_participants;
CREATE POLICY "Creator can insert participants"
  ON game_participants FOR INSERT WITH CHECK (
    auth.uid() = player_id OR
    game_id IN (SELECT my_created_game_ids())
  );

-- 3. Fix games SELECT policy: replace game_participants RLS lookup with fn
DROP POLICY IF EXISTS "Open games viewable by everyone" ON games;
CREATE POLICY "Open games viewable by everyone"
  ON games FOR SELECT USING (
    is_open = true OR
    auth.uid() = creator_id OR
    id IN (SELECT my_game_ids())
  );
