import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { muted?: boolean }
  const muted = Boolean(body.muted)

  const { data, error } = await supabase
    .from('conversation_participants')
    .update({ muted_at: muted ? new Date().toISOString() : null })
    .eq('conversation_id', id)
    .eq('user_id', user.id)
    .select('muted_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ muted: data.muted_at != null, muted_at: data.muted_at })
}
