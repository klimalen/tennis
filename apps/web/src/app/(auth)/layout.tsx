export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="text-3xl">🎾</span>
          <span className="text-2xl font-bold text-gray-900 tracking-tight">Tennis</span>
        </div>
        {children}
      </div>
    </div>
  )
}
