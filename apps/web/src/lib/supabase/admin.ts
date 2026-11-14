import { createClient } from '@supabase/supabase-js'

/** Service-role client for server-only jobs (push dispatch). Never import into client components. */
export function createAdminClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or Supabase URL')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
