import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { body?: string; image_url?: string }
  const text = body.body?.trim() ?? null
  const imageUrl = body.image_url ?? null

  if (!text && !imageUrl) {
    return NextResponse.json({ error: 'Post must have text or image' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: user.id, type: 'manual', body: text, image_url: imageUrl })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ post_id: data.id })
}
