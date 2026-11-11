const proxy = '/api/caldav'

export const proxyFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (new URL(url, window.location.href).origin === window.location.origin) {
    return fetch(input, init)
  }

  const headers = new Headers(init?.headers)
  headers.set('x-caldav-target', url)
  headers.set('x-caldav-method', init?.method ?? 'GET')
  const response = await fetch(proxy, {
    method: 'POST',
    headers,
    body: init?.body ?? null,
    signal: init?.signal ?? null,
  })
  if (response.headers.has('x-caldav-proxy-error') && response.status >= 500) {
    throw new TypeError('The proxy did not reach the server')
  }
  return response
}
