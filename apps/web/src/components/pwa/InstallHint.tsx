'use client'

import { useEffect, useState } from 'react'
import { Share, X } from 'lucide-react'

const DISMISS_KEY = 'pwa-install-dismissed'

type Kind = 'ios-safari' | 'ios-other' | 'android' | 'desktop'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function installed() {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function detect(): Kind | null {
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (iOS) {
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
    return safari ? 'ios-safari' : 'ios-other'
  }
  if (/Android/.test(ua)) return 'android'
  if (/Chrome|Edg|Chromium/.test(ua) && !/OPR|Opera/.test(ua)) return 'desktop'
  return null
}

function copy(kind: Kind, russian: boolean) {
  if (russian) {
    if (kind === 'ios-safari') {
      return {
        title: 'На экран «Домой»',
        steps: ['Нажмите «Поделиться» внизу Safari', 'Выберите «На экран Домой»'],
        button: null,
      }
    }
    if (kind === 'ios-other') {
      return {
        title: 'Откройте в Safari',
        steps: ['Откройте эту страницу в Safari', '«Поделиться», затем «На экран Домой»'],
        button: null,
      }
    }
    if (kind === 'android') {
      return {
        title: 'Установить приложение',
        steps: ['Меню Chrome, три точки справа сверху', '«Установить приложение» или «Добавить на главный экран»'],
        button: 'Установить',
      }
    }
    return {
      title: 'Установить приложение',
      steps: ['Значок установки справа в адресной строке', 'Или меню браузера → «Установить Tennis»'],
      button: 'Установить',
    }
  }
  if (kind === 'ios-safari') {
    return {
      title: 'Add to your home screen',
      steps: ['Tap Share at the bottom of Safari', 'Tap Add to Home Screen'],
      button: null,
    }
  }
  if (kind === 'ios-other') {
    return {
      title: 'Open in Safari',
      steps: ['Open this page in Safari', 'Tap Share, then Add to Home Screen'],
      button: null,
    }
  }
  if (kind === 'android') {
    return {
      title: 'Install the app',
      steps: ['Open the Chrome menu, three dots at the top right', 'Tap Install app or Add to Home screen'],
      button: 'Install',
    }
  }
  return {
    title: 'Install the app',
    steps: ['Use the install icon at the right of the address bar', 'Or the browser menu, then Install Tennis'],
    button: 'Install',
  }
}

export function InstallHint() {
  const [kind, setKind] = useState<Kind | null>(null)
  const [russian, setRussian] = useState(false)
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (installed()) return
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      return
    }
    setRussian(navigator.language.toLowerCase().startsWith('ru'))
    setKind(detect())

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ }
      setKind(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ }
    setKind(null)
  }

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    setPromptEvent(null)
    if (choice.outcome === 'accepted') dismiss()
  }

  if (!kind) return null
  const text = copy(kind, russian)

  return (
    <div className="rounded-[28px] bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-2xl leading-none tracking-wide text-[#1a1a1a]">{text.title}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={russian ? 'Закрыть' : 'Dismiss'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F6F1EA] text-[#1a1a1a]"
        >
          <X size={14} />
        </button>
      </div>
      <ol className="mt-3 space-y-1.5">
        {text.steps.map((step, index) => (
          <li key={step} className="flex items-start gap-2 text-[13px] leading-snug text-[rgba(26,26,26,0.7)]">
            <span className="mt-px w-3.5 shrink-0 text-[11px] font-medium text-[rgba(26,26,26,0.45)]">{index + 1}</span>
            <span className="font-copy inline-flex items-start gap-1.5">
              {kind === 'ios-safari' && index === 0 && <Share size={14} className="mt-0.5 shrink-0" />}
              {step}
            </span>
          </li>
        ))}
      </ol>
      {text.button && promptEvent && (
        <button
          type="button"
          onClick={install}
          className="mt-3 rounded-full bg-[#1a1a1a] px-4 py-2.5 text-[11px] tracking-[0.14em] uppercase text-[#FAF7F2]"
        >
          {text.button}
        </button>
      )}
    </div>
  )
}
