import { test as base, expect } from '@playwright/test'

export { expect }

// The paths of the dev server that lead to a CalDAV server: its proxies to Radicale and Baikal, and
// the proxy to a server of another address. The modules of the app (/src/api/caldav/…) are not them.
const isCalDav = (url: URL) => /^\/(radicale|dav\.php|api\/caldav)(\/|$)/.test(url.pathname)

/**
 * The test of the kinds that run on the seeded memory source (`?seed=…`): the layout tests and the
 * a11y tests. They have no CalDAV server: a call to one is refused, and fails the test.
 */
export const test = base.extend({
  page: async ({ page }, run) => {
    const asked: string[] = []
    await page.route(isCalDav, (route) => {
      asked.push(route.request().url())
      return route.abort()
    })
    await run(page)
    expect(asked, 'the page asked a CalDAV server').toEqual([])
  },
})
