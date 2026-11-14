'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isNativeGameApp } from '@/lib/native-app'

type BridgeResult = {
  status: 'granted' | 'denied' | 'unavailable' | 'error'
  token?: string
  platform?: 'ios' | 'android'
  message?: string
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
    __gamePushResult?: (result: BridgeResult) => void
  }
}

async function markPromptSeen() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('profiles')
    .update({ push_prompt_seen_at: new Date().toISOString() })
    .eq('id', user.id)
}

async function saveToken(token: string, platform: 'ios' | 'android' | 'web') {
  await fetch('/api/push-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform }),
  })
}

function requestNativePush(): Promise<BridgeResult> {
  return new Promise((resolve) => {
    if (!window.ReactNativeWebView) {
      resolve({ status: 'unavailable', message: 'Native bridge missing' })
      return
    }

    const timeout = window.setTimeout(() => {
      resolve({ status: 'error', message: 'Timed out waiting for permission' })
    }, 20000)

    window.__gamePushResult = (result) => {
      window.clearTimeout(timeout)
      resolve(result)
    }

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'request-push' }))
  })
}

export default function EnableNotificationsPage() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [native] = useState(() => isNativeGameApp())

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/sign-in?next=/notifications/enable')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_prompt_seen_at')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.push_prompt_seen_at) router.replace('/search')
    })
  }, [router])

  async function finish() {
    await markPromptSeen()
    router.replace('/search')
    router.refresh()
  }

  async function handleEnable() {
    if (busy) return
    setBusy(true)
    try {
      if (native) {
        const result = await requestNativePush()
        if (result.status === 'granted' && result.token) {
          await saveToken(result.token, result.platform ?? 'ios')
        }
      }
      await finish()
    } finally {
      setBusy(false)
    }
  }

  async function handleSkip() {
    if (busy) return
    setBusy(true)
    try {
      await finish()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="native-welcome relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-brand-bg text-[#1a1a1a]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[36%] bg-[#1E3A6E]" />
      <div aria-hidden className="pointer-events-none absolute -right-16 top-[14%] h-52 w-52 rounded-full bg-[#E8748A]/35 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -left-20 top-[24%] h-44 w-44 rounded-full bg-[#3A8A7A]/30 blur-2xl" />

      <div className="relative flex min-h-0 flex-1 flex-col px-6 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-[max(1rem,var(--app-safe-top,0px))]">
        <header className="shrink-0 pt-2">
          <p className="font-display text-[2.5rem] tracking-widest text-[#F0EBE3]">
            GAME<span className="-ml-[0.2em] tracking-normal">.</span>
          </p>
        </header>

        <main className="mt-auto flex min-h-0 flex-col justify-end">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white">
            <Bell size={24} className="text-[#1E3A6E]" />
          </div>
          <h1 className="max-w-[14ch] font-display text-[clamp(2.4rem,11vw,3.3rem)] leading-[0.9] tracking-wide">
            STAY IN THE LOOP
          </h1>
          <p className="mt-3 max-w-[26ch] font-fraunces text-lg italic leading-snug text-[#497250]">
            Get alerts about your games and new chat messages
          </p>
          <p className="mt-3 max-w-[32ch] text-[13px] leading-relaxed text-[rgba(26,26,26,0.62)]">
            Invites, schedule changes, and replies land on your lock screen so you do not miss a match.
          </p>
        </main>

        <footer className="mt-6 shrink-0 space-y-2.5">
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#E8748A] px-6 py-4 text-[12px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a] transition-colors active:bg-[#E8406A] disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Turn on notifications
          </button>
          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={busy}
            className="flex w-full items-center justify-center rounded-full border border-[#1a1a1a]/15 bg-white px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a] transition-colors active:bg-[#F4F1EC] disabled:opacity-50"
          >
            Not now
          </button>
        </footer>
      </div>
    </div>
  )
}
