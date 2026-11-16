import { servers } from './servers.ts'

// Removes the events that the tests of an earlier run left on the local servers. There are many of
// them after some runs, and a calendar with hundreds of events on a day is slow to read.
const headers = { Authorization: `Basic ${Buffer.from('dev:dev').toString('base64')}` }

// The beginnings of the titles that the tests give to the events that they make.
const testTitles =
  /^(E2E|A11y|Agenda|Remember|Retry|Proxied|Colored|Conflict|Delete|Daily|Repeats|Weekly|Mine|Office|Dbg|Details|Following|Attendees|Offline|Patch|Import|Export) /

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function clean({ origin, home }: (typeof servers)[keyof typeof servers]['direct']) {
  const ask = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
    fetch(`${origin}${path}`, { method: init.method, headers: { ...headers, ...init.headers } })
  const folders = new RegExp(`<(?:\\w+:)?href>${escape(home)}([^/<]+)/</(?:\\w+:)?href>`, 'g')
  const files = new RegExp(`<(?:\\w+:)?href>(${escape(home)}[^<]+\\.ics)</(?:\\w+:)?href>`, 'g')
  const listing = await (await ask(home, { method: 'PROPFIND', headers: { Depth: '1' } })).text()
  for (const [, slug] of listing.matchAll(folders)) {
    const list = await (
      await ask(`${home}${slug}/`, { method: 'PROPFIND', headers: { Depth: '1' } })
    ).text()
    await Promise.all(
      [...list.matchAll(files)].map(async ([, href]) => {
        const ics = await (await ask(href)).text()
        const title = /^SUMMARY:(.*)$/m.exec(ics)?.[1]?.trim() ?? ''
        if (testTitles.test(title)) await ask(href, { method: 'DELETE' })
      }),
    )
  }
}

export default async function globalSetup() {
  for (const { direct } of Object.values(servers)) {
    try {
      await clean(direct)
    } catch {
      // The server is not up yet, or has nothing to clean: the tests will say so.
    }
  }
}
