import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { allowedHostsFromEnv, proxyCalDav } from './caldav-proxy.ts'

async function handle(incoming: IncomingMessage, outgoing: ServerResponse) {
  const chunks: Buffer[] = []
  for await (const chunk of incoming) chunks.push(chunk as Buffer)
  const body = Buffer.concat(chunks)
  const headers = new Headers()
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (typeof value === 'string') headers.set(name, value)
  }
  const request = new Request('http://localhost/api/caldav', {
    method: incoming.method,
    headers,
    body: body.length ? body : undefined,
  })
  const response = await proxyCalDav(request, {
    allowedHosts: allowedHostsFromEnv(process.env.CALDAV_ALLOWED_HOSTS),
    allowPrivate: true,
  })
  outgoing.statusCode = response.status
  response.headers.forEach((value, name) => {
    outgoing.setHeader(name, value)
  })
  outgoing.end(Buffer.from(await response.arrayBuffer()))
}

export function caldavProxy(): Plugin {
  return {
    name: 'caldav-proxy',
    configureServer(server) {
      server.middlewares.use('/api/caldav', (incoming, outgoing) => {
        void handle(incoming, outgoing)
      })
    },
  }
}
