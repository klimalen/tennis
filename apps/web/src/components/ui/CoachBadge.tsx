export function CoachBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-[#3A8A7A] px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] uppercase text-[#F0EBE3] ${className}`}>
      Coach
    </span>
  )
}
