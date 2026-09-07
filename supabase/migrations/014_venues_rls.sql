-- Allow server-side upserts via service_role (used by API route)
CREATE POLICY "Venues upsertable by service role" ON venues
  FOR ALL
  USING (true)
  WITH CHECK (true);
