export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] min-w-0 max-w-full flex-col items-center justify-center overflow-x-clip bg-brand-bg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[calc(1.5rem+var(--app-safe-top,0px))]">
      <div className="w-full min-w-0 max-w-sm">
        <div className="mb-6 text-center">
          <span className="inline-block whitespace-nowrap font-display text-5xl tracking-widest text-brand-primary">
            GAME<span className="-ml-[0.25em] tracking-normal">.</span>
          </span>
          <p className="mt-1 pl-[0.3em] text-[10px] uppercase tracking-[0.3em] text-[rgba(26,26,26,0.4)]">
            Find · Play · Connect
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
