export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-surface flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <span className="font-display text-5xl tracking-widest text-brand-primary">TENNIS</span>
          <p className="text-[10px] tracking-[0.3em] uppercase text-[rgba(26,26,26,0.4)] mt-1">Find · Play · Connect</p>
        </div>
        {children}
      </div>
    </div>
  )
}
