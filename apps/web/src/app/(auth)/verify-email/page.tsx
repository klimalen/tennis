import Link from 'next/link'
import { Mail } from 'lucide-react'

export default function VerifyEmailPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
        <Mail size={24} className="text-green-600" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
      <p className="text-gray-500 text-sm mb-6">
        We sent you a link to verify your account. Check your inbox and spam folder.
      </p>
      <p className="text-xs text-gray-400">
        Already verified?{' '}
        <Link href="/sign-in" className="text-green-600 font-medium hover:text-green-700">
          Sign in
        </Link>
      </p>
    </div>
  )
}
