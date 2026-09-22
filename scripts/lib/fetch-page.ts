/**
 * Plain-HTTP page reader for the enrichment agent.
 * Keeps link targets as "text [url]" (the previous version stripped every <a href>,
 * so the agent could see search-result titles but never the URLs behind them).
 */

const MAX_CHARS = 12_000

export function htmlToText(html: string, baseUrl: string): string {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  t = t.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    let abs = decodeEntities(href)
    // DuckDuckGo / Bing style redirect links → real target
    const redirect = abs.match(/[?&](?:uddg|u|url)=([^&]+)/)
    if (redirect?.[1]) {
      try {
        abs = decodeURIComponent(redirect[1])
      } catch {
        /* keep */
      }
    }
    try {
      abs = new URL(abs, baseUrl).toString()
    } catch {
      /* keep raw */
    }
    if (!/^https?:/.test(abs) || !text) return text
    // Square brackets survive the generic tag strip below; angle brackets would not.
    return `${text} [${abs}]`
  })

  t = t
    .replace(/<(br|p|div|li|tr|h[1-6]|section|article|header|footer)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  t = decodeEntities(t)
    .replace(/[ \t\u00a0]{2,}/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()

  return t.length > MAX_CHARS ? `${t.slice(0, MAX_CHARS)}\n…(truncated)` : t
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
}

export async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      return `HTTP ${res.status} fetching ${url}. The site may block automated access — try another source (city parks page, court directories, school district site).`
    }
    const text = htmlToText(await res.text(), res.url || url)
    if (text.length < 200) {
      return `${text}\n\n(Page has almost no server-rendered text — probably a JavaScript app. Try a different page or source.)`
    }
    return text
  } catch (e) {
    return `Error fetching ${url}: ${e instanceof Error ? e.message : String(e)}`
  }
}
