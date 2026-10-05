/** True when the site is opened inside the GAME. iOS/Android WebView. */
export function isNativeGameApp(): boolean {
  if (typeof navigator === 'undefined') return false
  return /GAMENative\//.test(navigator.userAgent)
}
