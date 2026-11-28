/**
 * Large light watermark for profile / player cards.
 * Default: flush bottom-right. Pass position utilities (e.g. `top-0 right-2`)
 * to pin elsewhere. Pair with `overflow-hidden` on the card.
 */
export function CoachWatermark({ className = '' }: { className?: string }) {
  const positioned = /\b(top-|bottom-|left-|right-|inset-)/.test(className)
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-0 select-none font-display text-[52px] italic font-bold leading-none tracking-[-0.02em] text-[rgba(26,26,26,0.07)] sm:text-[58px] ${
        positioned ? '' : 'bottom-0 right-2'
      } ${className}`}
    >
      COACH
    </span>
  )
}

/**
 * Compact vintage nameplate Coach chip for lists / search cards.
 * Overlay with absolute + left-1/2 -translate-x-1/2 when pinning to an avatar.
 */
export function CoachBadge({ className = '' }: { className?: string }) {
  // Don't force `relative` when the caller already positions with absolute/fixed —
  // otherwise Tailwind's conflicting utilities can leave the chip in flow and shove the avatar.
  const positioned = /\b(absolute|fixed|sticky)\b/.test(className)

  return (
    <span
      className={`inline-flex h-[22px] w-[64px] shrink-0 items-center justify-center drop-shadow-[0_2px_3px_rgba(26,26,26,0.25)] ${
        positioned ? '' : 'relative'
      } ${className}`}
      aria-label="Coach"
    >
      <svg
        viewBox="0 0 64 22"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        <path
          d={PLATE_OUTER}
          fill="#F7F2EA"
          stroke="#2F6B5E"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={PLATE_INNER}
          fill="none"
          stroke="#2F6B5E"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        {/*
          SVG text is geometrically centered (textAnchor=middle).
          letterSpacing adds trailing advance — tiny dx balances it optically.
        */}
        <text
          x="32"
          y="11.7"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#2F6B5E"
          fontSize="8.25"
          fontWeight="700"
          letterSpacing="1.4"
          dx="0.7"
          fontFamily="var(--font-display), ui-sans-serif, system-ui, sans-serif"
        >
          COACH
        </text>
      </svg>
    </span>
  )
}

/**
 * Clockwise plate, viewBox 64×22, concave corner cuts (SVG sweep=0 = CCW).
 * Cut radius 3.1 so the vintage notch reads clearly at chip size.
 */
const PLATE_OUTER =
  'M 6.2 1.05 H 57.8 A 3.1 3.1 0 0 0 60.9 4.15 V 17.85 A 3.1 3.1 0 0 0 57.8 20.95 H 6.2 A 3.1 3.1 0 0 0 3.1 17.85 V 4.15 A 3.1 3.1 0 0 0 6.2 1.05 Z'

const PLATE_INNER =
  'M 8.1 3.1 H 55.9 A 2.1 2.1 0 0 0 58 5.2 V 16.8 A 2.1 2.1 0 0 0 55.9 18.9 H 8.1 A 2.1 2.1 0 0 0 6 16.8 V 5.2 A 2.1 2.1 0 0 0 8.1 3.1 Z'
