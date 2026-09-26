import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'

const MAX_CHARS = 2000
const MAX_BYTES = 5 * 1024 * 1024
const HOUR_LIMIT = 8

function characterCount(value: string) {
  return Array.from(value).length
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Could not read the form' }, { status: 400 })
  }

  const text = String(form.get('body') ?? '').trim()
  const count = characterCount(text)
  if (count < 1) return NextResponse.json({ error: 'Write a note first' }, { status: 400 })
  if (count > MAX_CHARS) return NextResponse.json({ error: 'That note is too long' }, { status: 400 })

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recent, error: countError } = await supabase
    .from('support_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  if (countError) return apiError(500, 'Could not send the note', countError)
  if ((recent ?? 0) >= HOUR_LIMIT) {
    return NextResponse.json({ error: 'You sent several notes just now. Try again in a little while.' }, { status: 429 })
  }

  const photo = form.get('photo')
  let imagePath: string | null = null

  if (photo instanceof File && photo.size > 0) {
    if (photo.type !== 'image/jpeg') {
      return NextResponse.json({ error: 'Photo must be a JPEG' }, { status: 400 })
    }
    if (photo.size > MAX_BYTES) {
      return NextResponse.json({ error: 'That photo is too large' }, { status: 400 })
    }
    const bytes = new Uint8Array(await photo.arrayBuffer())
    if (!isJpeg(bytes)) {
      return NextResponse.json({ error: 'Photo must be a JPEG' }, { status: 400 })
    }

    imagePath = `${user.id}/${crypto.randomUUID()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('support-images')
      .upload(imagePath, bytes, { contentType: 'image/jpeg', upsert: false })
    if (uploadError) return apiError(500, 'Could not upload the photo', uploadError)
  }

  const { data, error } = await supabase
    .from('support_messages')
    .insert({ user_id: user.id, body: text, image_path: imagePath })
    .select('id, created_at')
    .single()

  if (error) {
    if (imagePath) {
      await supabase.storage.from('support-images').remove([imagePath])
    }
    return apiError(500, 'Could not send the note', error)
  }

  return NextResponse.json({ id: data.id, created_at: data.created_at })
}
