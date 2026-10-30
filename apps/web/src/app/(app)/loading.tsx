/**
 * Instant feedback on tab / soft navigations inside the app shell.
 * Without this, Next keeps the previous page painted until the full RSC
 * (auth + data) finishes — which can feel like a 5–10s hang on a cold path.
 */
export default function AppLoading() {
  return (
    <div className="min-h-screen bg-brand-bg px-4 pt-6 pb-24 md:pb-8" aria-busy="true" aria-label="Loading">
      <div className="mx-auto max-w-2xl space-y-4 animate-pulse">
        <div className="h-9 w-40 rounded bg-brand-surface-md" />
        <div className="h-4 w-56 rounded bg-brand-surface" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 rounded-[28px] bg-white p-4">
            <div className="h-12 w-12 shrink-0 rounded-full bg-brand-surface-md" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-2/3 rounded bg-brand-surface-md" />
              <div className="h-3 w-full rounded bg-brand-surface" />
              <div className="h-3 w-4/5 rounded bg-brand-surface" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
