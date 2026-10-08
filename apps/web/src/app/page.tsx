import { headers } from 'next/headers'
import { WebLanding } from '@/components/home/WebLanding'
import { NativeWelcome } from '@/components/native/NativeWelcome'
import { isNativeGameAppUa } from '@/lib/native-app'

// Browsers get the public marketing page, including Google's brand check.
// The native app keeps its own one-screen welcome. Signed-in users are
// redirected away in middleware.
export default async function RootPage() {
  const ua = (await headers()).get('user-agent')
  if (isNativeGameAppUa(ua)) return <NativeWelcome />
  return <WebLanding />
}
