'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CourtDetailsForm, type CourtDetailsValues } from '@/components/court/CourtDetailsForm'

const FORM_ID = 'court-edit-form'

export function CourtEditPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [initial, setInitial] = useState<CourtDetailsValues | null>(null)
  const [dirty, setDirty] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null)
  const [error, setError] = useState('')
  const goneRef = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const savedAt = useRef(0)

  useEffect(() => {
    let active = true
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        router.push('/sign-in')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url, bio, city_name, city_lat, city_lng, address, phone, website, opening_hours, account_kind, court_count, preferred_surfaces, has_indoor, has_outdoor, lit, fee_hour_min, fee_hour_max, whatsapp, instagram, telegram, facebook')
        .eq('id', user.id)
        .single()

      if (!active) return
      if (!profile || profile.account_kind !== 'court') {
        router.replace('/me')
        return
      }

      setInitial({
        name: profile.full_name || '',
        username: profile.username || '',
        city: profile.city_name || '',
        cityLat: profile.city_lat ?? null,
        cityLng: profile.city_lng ?? null,
        address: profile.address || '',
        phone: profile.phone || '',
        website: profile.website || '',
        openingHours: profile.opening_hours || '',
        description: profile.bio || '',
        avatarUrl: profile.avatar_url || null,
        courtCount: profile.court_count != null ? String(profile.court_count) : '',
        surfaces: (profile.preferred_surfaces ?? []).filter((s: string) =>
          s === 'hard' || s === 'clay' || s === 'grass' || s === 'carpet' || s === 'synthetic',
        ),
        hasIndoor: profile.has_indoor ?? null,
        hasOutdoor: profile.has_outdoor ?? null,
        lit: profile.lit ?? null,
        feeHourMin: profile.fee_hour_min != null ? String(profile.fee_hour_min) : '',
        feeHourMax: profile.fee_hour_max != null ? String(profile.fee_hour_max) : '',
        whatsapp: profile.whatsapp || '',
        instagram: profile.instagram || '',
        telegram: profile.telegram || '',
        facebook: profile.facebook || '',
      })
      setLoading(false)
    }
    void load()
    return () => {
      active = false
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [router])

  function goToProfile() {
    if (goneRef.current) return
    goneRef.current = true
    window.location.assign('/me')
  }

  function finishSaved() {
    if (Date.now() - savedAt.current < 400) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    setSaveStatus(null)
    goToProfile()
  }

  function handleBack() {
    if (dirty) {
      setLeaveOpen(true)
      return
    }
    router.back()
  }

  function requestSave() {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null
    form?.requestSubmit()
  }

  if (loading || !initial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="w-6 h-6 border-2 border-brand-surface-md border-t-brand-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-8 bg-brand-bg">
      <div className="page-header">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors"
          >
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.5)]" />
          </button>
          <span className="font-display text-3xl tracking-wide flex-1">EDIT PROFILE</span>
          <button
            type="submit"
            form={FORM_ID}
            disabled={saveStatus === 'saving'}
            className="px-4 py-1.5 rounded-full bg-[#3A8A7A] text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#2F7466] transition-colors disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <CourtDetailsForm
          formId={FORM_ID}
          initial={initial}
          submitLabel="Save changes"
          allowPhoto
          hideSubmit
          onDirtyChange={setDirty}
          onSavingChange={(saving) => {
            if (saving) {
              setSaveStatus('saving')
              setError('')
              return
            }
            setSaveStatus((prev) => (prev === 'saving' ? null : prev))
          }}
          footer={(
            <p className="font-copy text-[12px] leading-snug text-[rgba(26,26,26,0.5)]">
              This information also appears on your court card in Search.
            </p>
          )}
          onSaved={() => {
            setDirty(false)
            setLeaveOpen(false)
            setError('')
            savedAt.current = Date.now()
            setSaveStatus('saved')
            if (saveTimer.current) window.clearTimeout(saveTimer.current)
            saveTimer.current = window.setTimeout(() => {
              setSaveStatus(null)
              goToProfile()
            }, 1000)
          }}
        />
      </div>

      {saveStatus && (
        <SaveNotice
          status={saveStatus}
          message={error}
          onClose={() => setSaveStatus(null)}
          onSavedDismiss={finishSaved}
        />
      )}
      {leaveOpen && (
        <UnsavedChangesDialog
          canSave={saveStatus !== 'saving'}
          onDismiss={() => setLeaveOpen(false)}
          onDiscard={() => {
            setLeaveOpen(false)
            router.back()
          }}
          onSave={() => {
            setLeaveOpen(false)
            requestSave()
          }}
        />
      )}
    </div>
  )
}

function SaveNotice({
  status,
  message,
  onClose,
  onSavedDismiss,
}: {
  status: 'saving' | 'saved' | 'error'
  message: string
  onClose: () => void
  onSavedDismiss: () => void
}) {
  function dismiss() {
    if (status === 'saving') return
    if (status === 'saved') onSavedDismiss()
    else onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-6 bg-black/25"
      onClick={dismiss}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving' : 'Something went wrong'}
        className="w-full max-w-[220px] rounded-[24px] bg-white px-5 py-6 text-center shadow-[0_12px_40px_rgba(26,26,26,0.16)]"
        onClick={(event) => {
          if (status !== 'saved') event.stopPropagation()
        }}
      >
        {status === 'saving' && (
          <>
            <Loader2 size={22} className="mx-auto animate-spin text-[#E8748A]" />
            <p className="mt-3 text-[10px] tracking-[0.18em] uppercase font-medium text-[#1a1a1a]">Saving</p>
          </>
        )}
        {status === 'saved' && (
          <>
            <div className="mx-auto w-8 h-8 rounded-full bg-[#3A8A7A] flex items-center justify-center">
              <Check size={16} className="text-[#F0EBE3]" />
            </div>
            <p className="mt-3 text-[10px] tracking-[0.18em] uppercase font-medium text-[#1a1a1a]">Saved</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-[10px] tracking-[0.16em] uppercase font-medium text-[#1a1a1a]">Something went wrong</p>
            {message && <p className="mt-2 text-xs text-[rgba(26,26,26,0.55)]">{message}</p>}
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-4 py-1.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.16em] uppercase font-medium"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function UnsavedChangesDialog({
  canSave,
  onDismiss,
  onDiscard,
  onSave,
}: {
  canSave: boolean
  onDismiss: () => void
  onDiscard: () => void
  onSave: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-6 bg-black/25"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="court-unsaved-title"
        className="relative w-full max-w-sm rounded-[28px] bg-white px-5 pb-5 pt-6 shadow-[0_12px_40px_rgba(26,26,26,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-brand-field border border-[#1a1a1a]/15 flex items-center justify-center"
        >
          <X size={14} className="text-[rgba(26,26,26,0.55)]" />
        </button>
        <h2 id="court-unsaved-title" className="font-display text-3xl tracking-wide pr-8 text-[#1a1a1a]">Unsaved changes</h2>
        <p className="mt-2 font-copy text-sm text-[rgba(26,26,26,0.6)]">You have changes that are not saved yet.</p>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="mt-5 w-full py-3 rounded-full bg-[#3A8A7A] text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#2F7466] transition-colors disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="mt-2 w-full py-3 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
