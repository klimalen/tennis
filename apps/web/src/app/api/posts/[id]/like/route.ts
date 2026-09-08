import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Toggle like: if liked → unlike, if not liked → like
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: postId } = await params

  const { data: existing } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
    return NextResponse.json({ liked: false })
  } else {
    await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
    return NextResponse.json({ liked: true })
  }
}
