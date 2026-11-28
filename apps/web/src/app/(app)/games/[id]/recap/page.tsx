'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, Globe, ImagePlus, Info, Loader2, Lock, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useHideTabBar } from '@/components/navigation/TabBarVisibility'
import { loadGameDetail, type GameDetail } from '@/components/games/GameDetailSheet'
import { formatRecapDate } from '@/components/ui/LocalGameTime'
import {
  RECAP_PHOTO_MAX,
  gameAccess,
  recapAudienceNotice,
  recapPlayerNames,
  viewerCanWriteRecap,
  type RecapPlayer,
  type RecapVisibility,
} from '@/lib/game-recap'
import { clampPostBody, POST_BODY_MAX } from '@/lib/post-limits'
import { holdsGameSeat } from '@/lib/schedule'
import { formatPlayFormat } from '@/lib/skill'
import { compressRecapPhoto } from '@/lib/recap-image'

type DraftPhoto =
  | { id: string; kind: 'saved'; url: string }
  | { id: string; kind: 'new'; file: File; preview: string }

const AUDIENCES: { id: RecapVisibility; label: string; hint: string; icon: typeof Lock }[] = [
  { id: 'private', label: 'Private', hint: 'Only you', icon: Lock },
  { id: 'friends', label: 'Friends', hint: 'Mutual followers', icon: Users },
  { id: 'public', label: 'Public', hint: 'Everyone', icon: Globe },
]

function roster(game: GameDetail): RecapPlayer[] {
  const courtHost = game.creator.account_kind === 'court'
  const players: RecapPlayer[] = []
  if (!courtHost) {
    players.push({
      id: game.creator.id,
      full_name: game.creator.full_name,
      username: game.creator.username,
      avatar_url: game.creator.avatar_url,
    })
  }
  for (const participant of game.participants) {
    if (participant.player_id === game.creator_id) continue
    if (!holdsGameSeat(participant.status)) continue
    if (participant.profile.account_kind === 'court') continue
    players.push({
      id: participant.profile.id,
      full_name: participant.profile.full_name,
      username: participant.profile.username,
      avatar_url: participant.profile.avatar_url,
    })
  }
  return players
}

export default function GameRecapPage() {
  useHideTabBar(true)
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const fileRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef<DraftPhoto[]>([])
  const [game, setGame] = useState<GameDetail | null>(null)
  const [recapId, setRecapId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState<RecapVisibility>('friends')
  const [photos, setPhotos] = useState<DraftPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [detail, recapRes, session] = await Promise.all([
        loadGameDetail(id),
        fetch(`/api/games/${id}/recap`),
        supabase.auth.getUser(),
      ])
      if (cancelled) return
      const userId = session.data.user?.id ?? null
      const recapJson = recapRes.ok ? await recapRes.json() as {
        recap: { id: string; body: string | null; visibility: RecapVisibility; image_urls: string[] } | null
      } : { recap: null }
      if (!detail) {
        setBlocked('This game is not available.')
        setLoading(false)
        return
      }
      setGame(detail)
      if (recapJson.recap) {
        setRecapId(recapJson.recap.id)
        setText(clampPostBody(recapJson.recap.body ?? ''))
        setVisibility(recapJson.recap.visibility ?? 'friends')
        setPhotos(recapJson.recap.image_urls.map((url) => ({ id: url, kind: 'saved' as const, url })))
      } else if (!viewerCanWriteRecap(detail, userId)) {
        setBlocked(
          detail.status === 'cancelled'
            ? "Cancelled games don't get a recap."
            : 'You can add a recap after the game, if you played in it.',
        )
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [id, supabase])

  photosRef.current = photos

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        if (photo.kind === 'new') URL.revokeObjectURL(photo.preview)
      }
    }
  }, [])

  function addPhotos(list: FileList | null) {
    if (!list || list.length === 0) return
    const incoming = [...list]
    const room = RECAP_PHOTO_MAX - photos.length
    if (room <= 0 || incoming.length > room) setError(`Up to ${RECAP_PHOTO_MAX} photos`)
    else setError('')
    const accepted = incoming.slice(0, Math.max(0, room))
    if (accepted.length === 0) {
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setPhotos((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        kind: 'new' as const,
        file,
        preview: URL.createObjectURL(file),
      })),
    ])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === photoId)
      if (photo?.kind === 'new') URL.revokeObjectURL(photo.preview)
      return current.filter((item) => item.id !== photoId)
    })
  }

  async function publish() {
    if (submitting) return
    const note = text.trim()
    if (!note && photos.length === 0) return
    setSubmitting(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Sign in to save your recap.')
      setSubmitting(false)
      return
    }

    let imageUrls: string[]
    try {
      imageUrls = await Promise.all(photos.map(async (photo) => {
        if (photo.kind === 'saved') return photo.url
        const blob = await compressRecapPhoto(photo.file)
        const path = `${user.id}/${crypto.randomUUID()}.jpg`
        const { error: uploadError } = await supabase.storage.from('post-images').upload(path, blob, { contentType: 'image/jpeg' })
        if (uploadError) throw new Error('upload')
        const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(path)
        return publicUrl
      }))
    } catch {
      setError('Could not upload a photo. Try again.')
      setSubmitting(false)
      return
    }

    const res = await fetch(`/api/games/${id}/recap`, {
      method: recapId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: note || null, visibility, image_urls: imageUrls }),
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { error?: string }
      setError(payload.error || 'Could not save the recap. Try again.')
      setSubmitting(false)
      return
    }
    router.push(`/game/${id}`)
    router.refresh()
  }

  async function removeRecap() {
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/games/${id}/recap`, { method: 'DELETE' })
    if (!res.ok) {
      setError('Could not delete the recap. Try again.')
      setSubmitting(false)
      setConfirmDelete(false)
      return
    }
    router.push(`/game/${id}`)
    router.refresh()
  }

  const canSave = (text.trim().length > 0 || photos.length > 0) && !submitting
  const players = game ? roster(game) : []
  const title = game?.court?.name?.trim() || game?.neighborhood?.trim() || (game ? formatPlayFormat(game.format) : '')
  const access = game ? gameAccess(game) : 'private'
  const notice = game ? recapAudienceNotice(access, visibility) : null

  return (
    <div className="min-h-screen pb-10">
      <div className="page-header">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1a1a1a]/15 bg-white hover:bg-brand-field"
            aria-label="Back"
          >
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </button>
          <span className="font-display text-2xl tracking-wide">GAME RECAP</span>
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1a1a1a]/15 bg-white hover:bg-brand-field"
            aria-label="Close"
          >
            <X size={16} className="text-[rgba(26,26,26,0.6)]" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 size={18} className="animate-spin text-[rgba(26,26,26,0.35)]" />
          </div>
        ) : blocked ? (
          <div className="rounded-[28px] bg-white px-5 py-10 text-center">
            <p className="font-display text-3xl tracking-wide text-[#1a1a1a]">NOT YET</p>
            <p className="mt-2 text-sm text-[rgba(26,26,26,0.5)]">{blocked}</p>
          </div>
        ) : game && (
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-medium text-[#1a1a1a]">{title}</p>
                <span className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] text-[rgba(26,26,26,0.45)]">
                  {access === 'open' ? <Globe size={12} /> : access === 'friends' ? <Users size={12} /> : <Lock size={12} />}
                  {access === 'open' ? 'Open' : access === 'friends' ? 'Friends' : 'Private'}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-[rgba(26,26,26,0.5)]">
                {formatRecapDate(game.scheduled_at, 'long')}
                <span> · {formatPlayFormat(game.format)}</span>
              </p>
              {players.length > 0 && (
                <div className="mt-3 flex items-center gap-2.5">
                  <div className="flex -space-x-2">
                    {players.slice(0, 4).map((player) => (
                      <div key={player.id} className="h-8 w-8 overflow-hidden rounded-full border-2 border-[#FAF7F2] bg-brand-avatar">
                        {player.avatar_url ? (
                          <Image src={player.avatar_url} alt="" width={32} height={32} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-display text-[11px]">
                            {(player.full_name[0] ?? '?').toUpperCase()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[13px] text-[#1a1a1a]">{recapPlayerNames(players)}</p>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[#1a1a1a]">How was your game?</p>
              <textarea
                value={text}
                onChange={(event) => setText(clampPostBody(event.target.value))}
                rows={4}
                maxLength={POST_BODY_MAX}
                placeholder="A note about the match, the rally, the company"
                className="font-copy w-full resize-none rounded-2xl border border-[#1a1a1a]/15 bg-white px-4 py-3 text-base leading-relaxed text-[#1a1a1a] outline-none placeholder:text-[rgba(26,26,26,0.35)]"
              />
              <p className="mt-1 text-right text-[9px] text-[rgba(26,26,26,0.4)]">{text.length}/{POST_BODY_MAX}</p>
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm font-medium text-[#1a1a1a]">Photos</p>
                <p className="text-[11px] text-[rgba(26,26,26,0.4)]">Optional</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative h-[88px] w-[88px] overflow-hidden rounded-2xl bg-brand-field">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.kind === 'saved' ? photo.url : photo.preview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      aria-label="Remove photo"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {photos.length < RECAP_PHOTO_MAX && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex h-[88px] w-[88px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#1a1a1a]/25 text-[rgba(26,26,26,0.45)] hover:border-[#1a1a1a]/50"
                  >
                    <ImagePlus size={16} />
                    <span className="text-[9px] uppercase tracking-[0.12em]">Add photos</span>
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => addPhotos(event.target.files)}
              />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-[#1a1a1a]">Who can see your recap?</legend>
              <div className="space-y-2">
                {AUDIENCES.map((option) => {
                  const selected = visibility === option.id
                  const Icon = option.icon
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-white px-4 py-3 ${
                        selected ? 'border-brand-fern' : 'border-[#1a1a1a]/10'
                      }`}
                    >
                      <input
                        type="radio"
                        name="recap-visibility"
                        value={option.id}
                        checked={selected}
                        onChange={() => setVisibility(option.id)}
                        className="sr-only"
                      />
                      <Icon size={16} className={selected ? 'text-brand-fern' : 'text-[rgba(26,26,26,0.45)]'} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-[#1a1a1a]">{option.label}</span>
                        <span className="block text-[12px] text-[rgba(26,26,26,0.45)]">{option.hint}</span>
                      </span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        selected ? 'border-brand-fern bg-brand-fern text-white' : 'border-[#1a1a1a]/20'
                      }`}>
                        {selected && <Check size={12} />}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {notice && (
              <p className="flex items-start gap-2 text-[12px] leading-relaxed text-[rgba(26,26,26,0.5)]">
                <Info size={14} className="mt-0.5 flex-shrink-0" />
                <span>{notice}</span>
              </p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={() => { void publish() }}
              disabled={!canSave}
              className="w-full rounded-2xl bg-brand-fern py-4 text-[13px] font-medium text-white transition-colors hover:bg-[#3d6144] disabled:cursor-default disabled:opacity-40"
            >
              {submitting ? <Loader2 size={16} className="mx-auto animate-spin" /> : recapId ? 'Save changes' : 'Publish recap'}
            </button>

            {recapId && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={submitting}
                className="w-full py-2 text-[12px] text-[rgba(26,26,26,0.45)] hover:text-red-500"
              >
                Delete recap
              </button>
            )}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6">
            <span className="mb-3 block font-display text-2xl tracking-wide">DELETE RECAP?</span>
            <p className="mb-5 text-sm text-[rgba(26,26,26,0.5)]">
              This removes your note and photos. The game stays on the schedule.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={submitting}
                className="flex-1 rounded-full border border-[#1a1a1a]/15 bg-brand-field py-2.5 text-sm font-medium"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={() => { void removeRecap() }}
                disabled={submitting}
                className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
