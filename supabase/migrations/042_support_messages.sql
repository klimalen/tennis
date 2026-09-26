-- Private support notes. Players can file their own; they cannot read anyone else's.
-- The service role, used by the dashboard, bypasses RLS and can read the inbox.

CREATE TABLE support_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_image_path_chk CHECK (
    image_path IS NULL
    OR (
      image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
      AND split_part(image_path, '/', 1) = user_id::text
    )
  )
);

CREATE INDEX support_messages_user_created_idx
  ON support_messages (user_id, created_at DESC);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_messages_select_own
  ON support_messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY support_messages_insert_own
  ON support_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      image_path IS NULL
      OR split_part(image_path, '/', 1) = auth.uid()::text
    )
  );

-- ─── Private photos. Not world-readable. ────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-images',
  'support-images',
  false,
  5242880,
  ARRAY['image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY support_images_owner_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'support-images'
    AND auth.uid() IS NOT NULL
    AND array_length(storage.foldername(name), 1) = 1
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND storage.extension(name) = 'jpg'
  );

CREATE POLICY support_images_owner_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'support-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY support_images_owner_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'support-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Do not delete storage.objects here. A statement trigger rejects that
-- and would block every account deletion. The app removes the photo
-- through the Storage API before calling this function.
CREATE OR REPLACE FUNCTION delete_current_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
