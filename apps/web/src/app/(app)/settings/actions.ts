'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function deleteAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { error } = await supabase.rpc('delete_current_user')
  if (error) throw new Error('Failed to delete account')

  await supabase.auth.signOut()
  redirect('/search')
}
