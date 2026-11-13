// Player sign-in and sign-up. Court signup stays email-only
// (OAuth cannot set account_kind: court).
// The Google brand is verified on game-tennis.space.
export const googleAuthEnabled = true

/** Show Continue with Google on player auth screens (web + native WebView). */
export function isGoogleAuthVisible(): boolean {
  return googleAuthEnabled
}
