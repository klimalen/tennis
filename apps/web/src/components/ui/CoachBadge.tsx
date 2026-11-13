/** Ticket-stub Coach chip — cream fill, teal stroke/type, side notches. */
export function CoachBadge({ className = '' }: { className?: string }) {
  // Don't force `relative` when the caller already positions with absolute/fixed —
  // otherwise Tailwind's conflicting utilities can leave the chip in flow and shove the avatar.
  const positioned = /\b(absolute|fixed|sticky)\b/.test(className)

  return (
    <span
      className={`inline-flex h-[22px] w-[78px] shrink-0 items-center justify-center drop-shadow-[0_1px_2px_rgba(26,26,26,0.18)] ${
        positioned ? '' : 'relative'
      } ${className}`}
      aria-label="Coach"
    >
      <svg
        viewBox="0 0 78 26"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        <path
          d="M6 1.25H72C74.485 1.25 75.75 2.515 75.75 5V8.25A4.75 4.75 0 0 0 75.75 17.75V21C75.75 23.485 74.485 24.75 72 24.75H6C3.515 24.75 2.25 23.485 2.25 21V17.75A4.75 4.75 0 0 1 2.25 8.25V5C2.25 2.515 3.515 1.25 6 1.25Z"
          fill="#F6F1E8"
          stroke="#2F6B5E"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span className="relative font-display text-[10px] font-medium leading-none tracking-[0.16em] text-[#2F6B5E]">
        COACH
      </span>
    </span>
  )
}
