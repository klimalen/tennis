/** Routes that render without the floating mobile tab bar. */
export function tabBarHiddenByPath(pathname: string): boolean {
  if (pathname === '/games/new' || pathname === '/feed/new' || pathname === '/me/edit') return true
  if (pathname.startsWith('/settings')) return true
  if (/^\/feed\/[^/]+\/edit$/.test(pathname)) return true
  if (pathname.startsWith('/chats/') && pathname.length > '/chats/'.length) return true
  return false
}
