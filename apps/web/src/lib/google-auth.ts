import { isNativeGameApp } from '@/lib/native-app'

// Player sign-in and sign-up. Court signup stays email-only.
// The Google brand is verified on game-tennis.space.
export const googleAuthEnabled = true

/** Hide Google in the native app: OAuth is blocked in WebViews, and App Store 4.8 needs Apple too. */
export function isGoogleAuthVisible(): boolean {
  return googleAuthEnabled && !isNativeGameApp()
}
