'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

const CLAMP: Record<1 | 2 | 3, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
}

export function ExpandableText({
  text,
  className,
  lines = 1,
}: {
  text: string
  className?: string
  /** Collapsed preview line count (default 1). */
  lines?: 1 | 2 | 3
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      if (open) return
      setOverflows(el.scrollHeight > el.clientHeight + 1)
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, open, lines])

  const canToggle = open || overflows

  return (
    <div
      className={`flex items-start gap-1.5 ${canToggle ? 'cursor-pointer' : ''}`}
      onClick={canToggle ? (event) => {
        event.preventDefault()
        event.stopPropagation()
        setOpen((value) => !value)
      } : undefined}
      onKeyDown={canToggle ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          setOpen((value) => !value)
        }
      } : undefined}
      role={canToggle ? 'button' : undefined}
      tabIndex={canToggle ? 0 : undefined}
      aria-expanded={canToggle ? open : undefined}
    >
      <p ref={ref} className={`${className ?? ''} min-w-0 flex-1 ${open ? '' : CLAMP[lines]}`}>
        {text}
      </p>
      {canToggle && (
        <ChevronDown
          size={14}
          className={`mt-0.5 shrink-0 text-[rgba(26,26,26,0.45)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      )}
    </div>
  )
}
