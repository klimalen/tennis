const NATIVE_UA = /GAMENative\//

/** True when the site is opened inside the GAME. iOS/Android WebView. */
export function isNativeGameApp(): boolean {
  if (typeof navigator === 'undefined') return false
  return NATIVE_UA.test(navigator.userAgent)
}

/** Server-side check from a request User-Agent. */
export function isNativeGameAppUa(ua: string | null | undefined): boolean {
  return Boolean(ua && NATIVE_UA.test(ua))
}
