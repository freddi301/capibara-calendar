import { allowedHostsFromEnv, proxyCalDav } from '../server/caldav-proxy.ts'

export function POST(request: Request) {
  return proxyCalDav(request, {
    allowedHosts: allowedHostsFromEnv(process.env.CALDAV_ALLOWED_HOSTS),
  })
}

export function GET() {
  return new Response('Use POST', { status: 405 })
}
