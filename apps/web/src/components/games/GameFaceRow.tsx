export interface GameFace {
  id: string
  name: string
  username: string | null
  avatarUrl: string | null
}

function initials(name: string) {
  return name.split(' ').map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase()
}

export function GameFaceRow({
  people,
  spotsLeft,
  onPerson,
  light = false,
}: {
  people: GameFace[]
  spotsLeft: number
  onPerson?: (person: GameFace) => void
  light?: boolean
}) {
  const shown = people.slice(0, 5)
  const extra = people.length - shown.length
  const nameClass = light ? 'text-[#F0EBE3]/80' : 'text-[rgba(26,26,26,0.55)]'
  const emptyClass = light
    ? 'border-[#F0EBE3]/50 text-[#F0EBE3]/80'
    : 'border-[#1a1a1a]/30 text-[rgba(26,26,26,0.45)]'

  return (
    <div className="flex items-start gap-3 overflow-x-auto">
      {shown.map((person) => {
        const face = (
          <>
            <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${light ? 'bg-[#F0EBE3]/20' : 'bg-brand-avatar'}`}>
              {person.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={person.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className={`font-display text-sm ${light ? 'text-[#F0EBE3]' : 'text-[#1a1a1a]'}`}>{initials(person.name)}</span>
              )}
            </div>
            <span className={`mt-1 max-w-[56px] truncate text-[10px] ${nameClass}`}>{person.name.split(' ')[0]}</span>
          </>
        )
        if (!onPerson || !person.username) {
          return (
            <div key={person.id} className="flex flex-col items-center w-14 flex-shrink-0">
              {face}
            </div>
          )
        }
        return (
          <button key={person.id} type="button" onClick={(event) => { event.stopPropagation(); onPerson(person) }} className="flex flex-col items-center w-14 flex-shrink-0">
            {face}
          </button>
        )
      })}
      {extra > 0 && (
        <div className="flex flex-col items-center w-14 flex-shrink-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[11px] ${light ? 'bg-[#F0EBE3]/15 text-[#F0EBE3]' : 'bg-brand-surface text-[rgba(26,26,26,0.55)]'}`}>
            +{extra}
          </div>
        </div>
      )}
      {spotsLeft > 0 && (
        <div className="flex flex-col items-center w-14 flex-shrink-0">
          <div className={`w-12 h-12 rounded-full border border-dashed flex items-center justify-center text-lg ${emptyClass}`}>+</div>
          <span className={`mt-1 text-[10px] ${nameClass}`}>Open</span>
        </div>
      )}
    </div>
  )
}
