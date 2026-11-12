import { proxyFetch } from '../../lib/proxy-fetch'

const redirects = [301, 302, 307, 308]

export async function discoverServerUrl(address: string, fetcher: typeof fetch = proxyFetch) {
  const url = new URL(address)
  if (url.pathname !== '/' || url.origin === window.location.origin) return address
  try {
    const wellKnown = new URL('/.well-known/caldav', url)
    const response = await fetcher(wellKnown.href, {
      method: 'GET',
      headers: { 'x-caldav-redirect': 'manual' },
    })
    const location = response.headers.get('location')
    if (!redirects.includes(response.status) || !location) return address
    const found = new URL(location, wellKnown)
    if (found.hostname !== url.hostname) return found.href
    return new URL(`${found.pathname}${found.search}`, url.origin).href
  } catch {
    return address
  }
}
