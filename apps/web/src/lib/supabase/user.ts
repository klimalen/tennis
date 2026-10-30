import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * One Auth round-trip per RSC request. Pages wrapped in AuthGate used to call
 * getUser again inside the child, stacking two (plus middleware) before data.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
