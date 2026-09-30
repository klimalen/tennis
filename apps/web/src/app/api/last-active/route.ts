import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse(null, { status: 204 })

  const { error } = await supabase.rpc('touch_last_active')
  if (error) console.error('touch_last_active', error.message)

  return new NextResponse(null, { status: 204 })
}
