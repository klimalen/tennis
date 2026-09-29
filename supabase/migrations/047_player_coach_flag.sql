-- A player may mark themselves as a coach. Other system columns stay locked.

GRANT UPDATE (is_coach) ON public.profiles TO authenticated;

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
