export type ProxyOptions = {
  allowedHosts?: string[]
  allowPrivate?: boolean
}

const requestHeaders = [
  'authorization',
  'content-type',
  'depth',
  'if-match',
  'if-none-match',
  'prefer',
  'accept',
]

const responseHeaders = ['content-type', 'etag', 'dav', 'allow', 'last-modified']

const privateAddress =
  /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|\[(::1?|f[cd][0-9a-f]{2}:|fe80:))/i

function isPrivateHost(hostname: string) {
  const name = hostname.toLowerCase()
  return (
    name === 'localhost' ||
    name.endsWith('.localhost') ||
    name.endsWith('.local') ||
    name.endsWith('.internal') ||
    privateAddress.test(name)
  )
}

export function isAllowedTarget(
  url: URL,
  { allowedHosts = [], allowPrivate = false }: ProxyOptions = {},
) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  if (allowedHosts.length)
    return allowedHosts.includes(url.host) || allowedHosts.includes(url.hostname)
  return allowPrivate || !isPrivateHost(url.hostname)
}

export function allowedHostsFromEnv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
}

const failed = (status: number, message: string) =>
  new Response(message, { status, headers: { 'x-caldav-proxy-error': 'true' } })

export async function proxyCalDav(request: Request, options: ProxyOptions = {}) {
  if (request.method !== 'POST') return failed(405, 'Use POST')

  let target: URL
  try {
    target = new URL(request.headers.get('x-caldav-target') ?? '')
  } catch {
    return failed(400, 'No address to talk to')
  }
  if (!isAllowedTarget(target, options)) return failed(403, 'This server cannot be talked to')

  const method = (request.headers.get('x-caldav-method') ?? 'GET').toUpperCase()
  if (!/^[A-Z-]+$/.test(method) || method === 'CONNECT' || method === 'TRACE') {
    return failed(400, 'Not a method')
  }

  const headers = new Headers()
  for (const name of requestHeaders) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const isRedirectSeen = request.headers.get('x-caldav-redirect') === 'manual'
  const hasBody = method !== 'GET' && method !== 'HEAD'
  try {
    const response = await fetch(target, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: isRedirectSeen ? 'manual' : 'follow',
    })
    const answer = new Headers()
    for (const name of isRedirectSeen ? [...responseHeaders, 'location'] : responseHeaders) {
      const value = response.headers.get(name)
      if (value) answer.set(name, value)
    }
    const hasAnswerBody = response.status !== 204 && response.status !== 304 && method !== 'HEAD'
    return new Response(hasAnswerBody ? await response.arrayBuffer() : null, {
      status: response.status,
      headers: answer,
    })
  } catch {
    return failed(502, 'The server did not answer')
  }
}

const env = globalThis as { process?: { env: Record<string, string | undefined> } }

export function POST(request: Request) {
  return proxyCalDav(request, {
    allowedHosts: allowedHostsFromEnv(env.process?.env.CALDAV_ALLOWED_HOSTS),
  })
}

export function GET() {
  return new Response('Use POST', { status: 405 })
}
