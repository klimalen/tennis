export function shareCard({
  kicker,
  title,
  line,
  pill,
}: {
  kicker: string
  title: string
  line?: string | null
  pill?: string | null
}) {
  const heading = title.trim().slice(0, 72)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#FAF7F2',
        padding: '72px',
        color: '#1a1a1a',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 32, letterSpacing: 2, fontWeight: 700 }}>GAME.</div>
        <div style={{ fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', color: '#E8748A' }}>{kicker}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: heading.length > 28 ? 64 : 80, lineHeight: 0.95, letterSpacing: -1, textTransform: 'uppercase' }}>{heading}</div>
        {line ? (
          <div style={{ marginTop: 28, fontSize: 32, lineHeight: 1.25, color: 'rgba(26,26,26,0.62)' }}>{line.slice(0, 90)}</div>
        ) : null}
        {pill ? (
          <div style={{ display: 'flex', marginTop: 28 }}>
            <div style={{ background: '#3A8A7A', color: '#F0EBE3', fontSize: 22, letterSpacing: 3, textTransform: 'uppercase', padding: '12px 18px', borderRadius: 999 }}>{pill}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
