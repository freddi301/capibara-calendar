// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { proxyFetch } from '@/lib/proxy-fetch'

const upstream = vi.fn<typeof fetch>()
const addressOf = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

beforeEach(() => {
  upstream.mockResolvedValue(new Response('<xml/>', { status: 207 }))
  vi.stubGlobal('fetch', upstream)
})

afterEach(() => {
  upstream.mockReset()
  vi.unstubAllGlobals()
})

const lastCall = () => {
  const [address, init] = upstream.mock.calls[0]
  return { address: addressOf(address), init: init as RequestInit & { headers: Headers } }
}

it('goes straight to a server of this site', async () => {
  await proxyFetch(`${window.location.origin}/radicale/dev/`, { method: 'PROPFIND' })
  await proxyFetch('/radicale/dev/', { method: 'REPORT' })

  expect(upstream.mock.calls.map(([address]) => addressOf(address))).toEqual([
    `${window.location.origin}/radicale/dev/`,
    '/radicale/dev/',
  ])
})

it('goes through the proxy for a server of another domain, with what it means to ask', async () => {
  const response = await proxyFetch('https://drive.example.org/remote.php/dav/', {
    method: 'PROPFIND',
    headers: { Authorization: 'Basic abc', Depth: '0', 'Content-Type': 'application/xml' },
    body: '<propfind/>',
  })

  expect(response.status).toBe(207)
  const { address, init } = lastCall()
  expect(address).toBe('/api/caldav')
  expect(init.method).toBe('POST') // a POST goes through where PROPFIND might not
  expect(init.headers.get('x-caldav-target')).toBe('https://drive.example.org/remote.php/dav/')
  expect(init.headers.get('x-caldav-method')).toBe('PROPFIND')
  expect(init.headers.get('authorization')).toBe('Basic abc')
  expect(init.headers.get('depth')).toBe('0')
  expect(init.body).toBe('<propfind/>')
})

it('is a GET when no method is given, with no body', async () => {
  await proxyFetch(new URL('https://drive.example.org/remote.php/dav/x.ics'))

  expect(lastCall().init.headers.get('x-caldav-method')).toBe('GET')
  expect(lastCall().init.body).toBeNull()
})

it('lets the answer through, whatever its status, when the proxy did its work', async () => {
  upstream.mockResolvedValue(new Response('no', { status: 401 }))

  const response = await proxyFetch('https://drive.example.org/dav/', { method: 'PROPFIND' })

  expect(response.status).toBe(401) // the login is not right: said by the server
})

it('fails as a request that did not get to a server does, when the proxy could not reach it', async () => {
  upstream.mockResolvedValue(
    new Response('down', { status: 502, headers: { 'x-caldav-proxy-error': 'true' } }),
  )

  await expect(
    proxyFetch('https://drive.example.org/dav/', { method: 'PROPFIND' }),
  ).rejects.toBeInstanceOf(TypeError)
})

it('lets a 502 of the server itself through', async () => {
  upstream.mockResolvedValue(new Response('bad gateway', { status: 502 }))

  const response = await proxyFetch('https://drive.example.org/dav/', { method: 'PROPFIND' })

  expect(response.status).toBe(502)
})
