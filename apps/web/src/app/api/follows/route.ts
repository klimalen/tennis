import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/follows  { following_id }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { following_id?: string }
  const { following_id } = body
  if (!following_id) return NextResponse.json({ error: 'following_id required' }, { status: 400 })
  if (following_id === user.id) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })

  const { error } = await supabase
    .from('follows')
    .upsert({ follower_id: user.id, following_id }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/follows  { following_id }
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { following_id?: string }
  const { following_id } = body
  if (!following_id) return NextResponse.json({ error: 'following_id required' }, { status: 400 })

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', following_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
