// Removes the events that the tests of an earlier run left on the local server. There are many of
// them after some runs, and a calendar with hundreds of events on a day is slow to read.
const base = 'http://localhost:5232'
const headers = { Authorization: `Basic ${Buffer.from('dev:dev').toString('base64')}` }

// The beginnings of the titles that the tests give to the events that they make.
const testTitles =
  /^(E2E|A11y|Agenda|Remember|Retry|Proxied|Colored|Conflict|Delete|Daily|Repeats|Weekly|Mine|Office|Dbg|Details|Following|Attendees) /

async function ask(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return fetch(`${base}${path}`, {
    method: init.method,
    headers: { ...headers, ...init.headers },
  })
}

export default async function globalSetup() {
  try {
    const home = await (await ask('/dev/', { method: 'PROPFIND', headers: { Depth: '1' } })).text()
    const slugs = [...home.matchAll(/<(?:\w+:)?href>\/dev\/([^/<]+)\/<\/(?:\w+:)?href>/g)].map(
      (match) => match[1],
    )
    for (const slug of slugs) {
      const list = await (
        await ask(`/dev/${slug}/`, { method: 'PROPFIND', headers: { Depth: '1' } })
      ).text()
      const events = [...list.matchAll(/<(?:\w+:)?href>(\/dev\/[^<]+\.ics)<\/(?:\w+:)?href>/g)].map(
        (match) => match[1],
      )
      await Promise.all(
        events.map(async (href) => {
          const ics = await (await ask(href)).text()
          const title = /^SUMMARY:(.*)$/m.exec(ics)?.[1]?.trim() ?? ''
          if (testTitles.test(title)) await ask(href, { method: 'DELETE' })
        }),
      )
    }
  } catch {
    // The server is not up yet, or has nothing to clean: the tests will say so.
  }
}
