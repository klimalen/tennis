'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Image as ImageIcon, Loader2, X } from 'lucide-react'
import { prepareSupportPhoto } from '@/lib/support-photo'

type Note = {
  id: string
  body: string
  created_at: string
  image_url: string | null
}

const MAX_CHARS = 2000

export default function SupportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancel = false
    fetch('/api/support')
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json() as { messages?: Note[] }
        if (!cancel) setNotes(data.messages ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!photo) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  function clearPhoto() {
    setPhoto(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    try {
      setPhoto(await prepareSupportPhoto(file))
    } catch (err) {
      clearPhoto()
      setError(err instanceof Error ? err.message : 'Could not prepare the photo. Try again.')
    }
  }

  async function handleSubmit() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError('')

    const form = new FormData()
    form.set('body', body)
    if (photo) form.set('photo', photo, 'photo.jpg')

    const res = await fetch('/api/support', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({})) as { error?: string; id?: string; created_at?: string }
    if (!res.ok || !data.id) {
      setError(data.error || 'Could not send the note. Try again.')
      setSending(false)
      return
    }

    setText('')
    setPhoto(null)
    if (fileRef.current) fileRef.current.value = ''
    const list = await fetch('/api/support')
    if (list.ok) {
      const payload = await list.json() as { messages?: Note[] }
      setNotes(payload.messages ?? [])
    }
    setSent(true)
    setSending(false)
  }

  const count = Array.from(text.trim()).length
  const canSend = count > 0 && count <= MAX_CHARS && !sending

  return (
    <div className="min-h-screen bg-brand-bg pb-8">
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors"
          >
            <ChevronLeft size={20} className="text-[rgba(26,26,26,0.5)]" />
          </button>
          <span className="font-display text-5xl tracking-wide">SUPPORT</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-[28px] px-4 py-5">
          {sent ? (
            <div className="py-6 text-center">
              <p className="font-display text-4xl tracking-wide">SENT</p>
              <p className="font-copy mt-2 text-sm text-[rgba(26,26,26,0.55)]">Thanks. We will read it.</p>
              <button
                onClick={() => setSent(false)}
                className="mt-5 rounded-full bg-[#1a1a1a] px-5 py-2.5 text-[11px] tracking-[0.14em] uppercase text-[#FAF7F2]"
              >
                Send another
              </button>
            </div>
          ) : (
            <>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">Your note</p>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="What should we know?"
                rows={6}
                maxLength={MAX_CHARS}
                className="font-copy mt-3 w-full resize-none rounded-lg border border-[#1a1a1a]/40 bg-brand-field px-4 py-3 text-base leading-relaxed text-[#1a1a1a] outline-none placeholder:text-[rgba(26,26,26,0.4)]"
              />
              {count > 1600 && (
                <p className="mt-2 text-right text-[11px] text-[rgba(26,26,26,0.4)]">{count}/{MAX_CHARS}</p>
              )}

              {preview && (
                <div className="relative mt-4 overflow-hidden rounded-[20px] bg-brand-field">
                  {/* Local preview of a photo that has not been uploaded yet. */}
                  <img src={preview} alt="" className="max-h-80 w-full object-contain" />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90"
                    aria-label="Remove photo"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 rounded-full border border-[#1a1a1a]/15 bg-brand-field px-4 py-2 text-[#1a1a1a] hover:border-[#1a1a1a]/60"
                >
                  <ImageIcon size={18} />
                  <span className="text-[10px] font-medium uppercase tracking-[0.15em]">
                    {photo ? 'Change photo' : 'Add photo'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSend}
                  className="rounded-full bg-[#1a1a1a] px-5 py-2.5 text-[11px] tracking-[0.14em] uppercase text-[#FAF7F2] disabled:cursor-default disabled:opacity-40"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : 'Send'}
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePick}
              />
            </>
          )}
        </div>

        {!loading && notes.length > 0 && (
          <div className="space-y-3">
            <p className="px-1 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">Sent</p>
            {notes.map((note) => (
              <article key={note.id} className="bg-white rounded-[28px] px-4 py-4">
                <p className="font-copy text-sm leading-relaxed text-[#1a1a1a] whitespace-pre-wrap">{note.body}</p>
                {note.image_url && (
                  <img src={note.image_url} alt="" className="mt-3 max-h-80 w-full rounded-[20px] object-contain bg-brand-field" />
                )}
                <p className="mt-3 text-[11px] text-[rgba(26,26,26,0.4)]">
                  {new Date(note.created_at).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
