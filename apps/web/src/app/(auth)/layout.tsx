export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 max-w-full flex-col items-center justify-center overflow-x-clip bg-brand-bg px-4 py-12">
      <div className="w-full min-w-0 max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <span className="inline-block whitespace-nowrap font-display text-5xl tracking-widest text-brand-primary">
            GAME<span className="-ml-[0.25em] tracking-normal">.</span>
          </span>
          <p className="text-[10px] tracking-[0.3em] pl-[0.3em] uppercase text-[rgba(26,26,26,0.4)] mt-1">Find · Play · Connect</p>
        </div>
        {children}
      </div>
    </div>
  )
}
