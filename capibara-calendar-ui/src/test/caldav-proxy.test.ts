import { afterEach, describe, expect, it, vi } from 'vitest'
import { allowedHostsFromEnv, isAllowedTarget, proxyCalDav } from '../../api/caldav'

const addressOf = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

const allowed = (address: string, options = {}) => isAllowedTarget(new URL(address), options)

describe('the servers that can be talked to', () => {
  it('are the ones of the Internet, by default', () => {
    expect(allowed('https://drive.example.org/remote.php/dav')).toBe(true)
    expect(allowed('http://caldav.example.org:8080/')).toBe(true)
  })

  it('are not the ones of the computer, or of its network, by default', () => {
    for (const address of [
      'http://localhost:5232/',
      'http://sub.localhost/',
      'http://127.0.0.1/',
      'http://10.1.2.3/',
      'http://192.168.1.10/',
      'http://172.16.0.1/',
      'http://172.31.255.1/',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/',
      'http://nas.local/',
      'http://db.internal/',
    ]) {
      expect(allowed(address), address).toBe(false)
    }
    expect(allowed('http://172.32.0.1/')).toBe(true) // not one of the private ones
  })

  it('are the ones of the computer too, when developing', () => {
    expect(allowed('http://localhost:5232/', { allowPrivate: true })).toBe(true)
    expect(allowed('http://192.168.1.10/', { allowPrivate: true })).toBe(true)
  })

  it('are only the ones that are named, when some are', () => {
    const options = { allowedHosts: ['drive.example.org', 'caldav.example.org:8080'] }
    expect(allowed('https://drive.example.org/dav', options)).toBe(true)
    expect(allowed('http://caldav.example.org:8080/', options)).toBe(true)
    expect(allowed('https://other.example.org/dav', options)).toBe(false)
    expect(allowed('http://caldav.example.org:9090/', options)).toBe(false)
    expect(allowed('http://localhost:5232/', { ...options, allowPrivate: true })).toBe(false)
  })

  it('are only the ones of the web', () => {
    expect(allowed('file:///etc/passwd', { allowPrivate: true })).toBe(false)
    expect(allowed('ftp://files.example.org/')).toBe(false)
  })
})

describe('the names of the servers in the settings', () => {
  it('are the ones between commas, without spaces around them or empty ones', () => {
    expect(allowedHostsFromEnv(' drive.example.org , caldav.example.org:8080,, ')).toEqual([
      'drive.example.org',
      'caldav.example.org:8080',
    ])
    expect(allowedHostsFromEnv('')).toEqual([])
    expect(allowedHostsFromEnv(undefined)).toEqual([])
  })
})

describe('the proxy', () => {
  const upstream = vi.fn<typeof fetch>()
  afterEach(() => {
    upstream.mockReset()
    vi.unstubAllGlobals()
  })

  const call = (headers: Record<string, string>, options = {}, body?: string, method = 'POST') => {
    vi.stubGlobal('fetch', upstream)
    return proxyCalDav(
      new Request('http://localhost/api/caldav', { method, headers, body }),
      options,
    )
  }
  const sent = () => {
    const [target, init] = upstream.mock.calls[0]
    return { target: addressOf(target), init: init as RequestInit & { headers: Headers } }
  }
  const target = 'https://drive.example.org/remote.php/dav/'

  it('makes the request that the page means, with the method, the address, the headers and the body', async () => {
    upstream.mockResolvedValue(new Response('<xml/>', { status: 207 }))

    const response = await call(
      {
        'x-caldav-target': target,
        'x-caldav-method': 'PROPFIND',
        authorization: 'Basic YWRhOnNlY3JldA==',
        depth: '1',
        'content-type': 'application/xml',
        cookie: 'session=secret',
        'x-forwarded-for': '1.2.3.4',
      },
      {},
      '<propfind/>',
    )

    expect(response.status).toBe(207)
    expect(await response.text()).toBe('<xml/>')
    const { target: address, init } = sent()
    expect(address).toBe(target)
    expect(init.method).toBe('PROPFIND')
    expect(init.headers.get('authorization')).toBe('Basic YWRhOnNlY3JldA==')
    expect(init.headers.get('depth')).toBe('1')
    expect(init.headers.get('content-type')).toBe('application/xml')
    expect(init.headers.has('cookie')).toBe(false) // what is not needed is not sent on
    expect(init.headers.has('x-forwarded-for')).toBe(false)
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('<propfind/>')
  })

  it('brings back the status, and the headers that the page needs, and not the others', async () => {
    upstream.mockResolvedValue(
      new Response('ok', {
        status: 200,
        headers: {
          'content-type': 'text/calendar',
          etag: '"abc"',
          dav: '1, calendar-access',
          'set-cookie': 'session=secret',
          'www-authenticate': 'Basic realm="Drive"',
          'content-encoding': 'gzip',
        },
      }),
    )

    const response = await call({ 'x-caldav-target': target, 'x-caldav-method': 'GET' })

    expect(response.headers.get('content-type')).toBe('text/calendar')
    expect(response.headers.get('etag')).toBe('"abc"')
    expect(response.headers.get('dav')).toBe('1, calendar-access')
    expect(response.headers.has('set-cookie')).toBe(false)
    expect(response.headers.has('www-authenticate')).toBe(false) // it would make a password box
    expect(response.headers.has('content-encoding')).toBe(false)
  })

  it('says that the login is not right as the server does, with its 401', async () => {
    upstream.mockResolvedValue(new Response('no', { status: 401 }))

    const response = await call({ 'x-caldav-target': target, 'x-caldav-method': 'PROPFIND' })

    expect(response.status).toBe(401)
    expect(response.headers.has('x-caldav-proxy-error')).toBe(false) // the proxy did its work
  })

  it('does not send a body with a GET, and none back for a 204', async () => {
    upstream.mockResolvedValue(new Response(null, { status: 204 }))

    const response = await call({ 'x-caldav-target': target, 'x-caldav-method': 'GET' })

    expect(sent().init.body).toBeUndefined()
    expect(response.status).toBe(204)
    expect(response.body).toBeNull()
  })

  it('does what PUT, DELETE and the others of CalDAV ask, with the If-Match of the page', async () => {
    upstream.mockResolvedValue(new Response(null, { status: 204 }))

    await call(
      {
        'x-caldav-target': `${target}calendars/ada/personal/1.ics`,
        'x-caldav-method': 'put',
        'if-match': '"abc"',
        'content-type': 'text/calendar',
      },
      {},
      'BEGIN:VCALENDAR',
    )

    expect(sent().init.method).toBe('PUT')
    expect(sent().init.headers.get('if-match')).toBe('"abc"')
  })

  it('does not take a request that is not a POST', async () => {
    const response = await call({ 'x-caldav-target': target }, {}, undefined, 'GET')
    expect(response.status).toBe(405)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('does not take a request without a server, or with one that is not an address', async () => {
    expect((await call({ 'x-caldav-method': 'GET' })).status).toBe(400)
    expect((await call({ 'x-caldav-target': 'not an address' })).status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('does not talk to a server that is not allowed, and says so', async () => {
    const local = await call({
      'x-caldav-target': 'http://localhost:5232/',
      'x-caldav-method': 'GET',
    })
    const named = await call(
      { 'x-caldav-target': 'https://other.example.org/', 'x-caldav-method': 'GET' },
      { allowedHosts: ['drive.example.org'] },
    )
    const file = await call({ 'x-caldav-target': 'file:///etc/passwd' }, { allowPrivate: true })

    expect([local.status, named.status, file.status]).toEqual([403, 403, 403])
    expect(upstream).not.toHaveBeenCalled()
    expect(local.headers.get('x-caldav-proxy-error')).toBe('true')
  })

  it('does not make a request with a method that is not one', async () => {
    for (const method of ['CONNECT', 'TRACE', 'GET /x HTTP/1.1', '']) {
      const response = await call({ 'x-caldav-target': target, 'x-caldav-method': method })
      expect(response.status, method).toBe(400)
    }
    expect(upstream).not.toHaveBeenCalled()
  })

  it('says that the server did not answer, as the proxy and not as the server', async () => {
    upstream.mockRejectedValue(new TypeError('fetch failed'))

    const response = await call({ 'x-caldav-target': target, 'x-caldav-method': 'PROPFIND' })

    expect(response.status).toBe(502)
    expect(response.headers.get('x-caldav-proxy-error')).toBe('true')
  })
})
