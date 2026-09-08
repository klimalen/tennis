-- Fix FK constraints so that deleting a user cascades properly through all tables.
-- Without this, DELETE FROM auth.users fails with FK violation on games/game_participants/match_results.

-- games.creator_id
ALTER TABLE games
  DROP CONSTRAINT games_creator_id_fkey,
  ADD CONSTRAINT games_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- game_participants.player_id
ALTER TABLE game_participants
  DROP CONSTRAINT game_participants_player_id_fkey,
  ADD CONSTRAINT game_participants_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- match_results: winner_id / submitted_by / confirmed_by
ALTER TABLE match_results
  DROP CONSTRAINT match_results_winner_id_fkey,
  ADD CONSTRAINT match_results_winner_id_fkey
    FOREIGN KEY (winner_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE match_results
  DROP CONSTRAINT match_results_submitted_by_fkey,
  ADD CONSTRAINT match_results_submitted_by_fkey
    FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE match_results
  DROP CONSTRAINT match_results_confirmed_by_fkey,
  ADD CONSTRAINT match_results_confirmed_by_fkey
    FOREIGN KEY (confirmed_by) REFERENCES profiles(id) ON DELETE SET NULL;
