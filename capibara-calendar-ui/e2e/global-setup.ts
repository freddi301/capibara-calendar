import { servers } from './servers.ts'

// Empties the calendars of the test servers (radicale-e2e and baikal-e2e): a container that stays up
// between runs keeps what the tests left, and a calendar with hundreds of events on a day is slow to
// read. Contacts are not touched.

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function clean(
  { origin, home: homeOf }: (typeof servers)[keyof typeof servers]['direct'],
  user: string,
) {
  const home = homeOf(user)
  const headers = { Authorization: `Basic ${Buffer.from(`${user}:dev`).toString('base64')}` }
  const ask = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
    fetch(`${origin}${path}`, { method: init.method, headers: { ...headers, ...init.headers } })
  const folders = new RegExp(`<(?:\\w+:)?href>${escape(home)}([^/<]+)/</(?:\\w+:)?href>`, 'g')
  const files = new RegExp(`<(?:\\w+:)?href>(${escape(home)}[^<]+\\.ics)</(?:\\w+:)?href>`, 'g')
  const listing = await (await ask(home, { method: 'PROPFIND', headers: { Depth: '1' } })).text()
  for (const [, slug] of listing.matchAll(folders)) {
    const list = await (
      await ask(`${home}${slug}/`, { method: 'PROPFIND', headers: { Depth: '1' } })
    ).text()
    await Promise.all([...list.matchAll(files)].map(([, href]) => ask(href, { method: 'DELETE' })))
  }
}

export default async function globalSetup() {
  for (const { direct, users } of Object.values(servers)) {
    for (const user of users) {
      try {
        await clean(direct, user)
      } catch {
        // The server is not up yet, or has nothing to clean: the tests will say so.
      }
    }
  }
}
