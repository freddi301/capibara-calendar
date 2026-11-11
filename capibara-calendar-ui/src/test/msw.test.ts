import { DAVNamespaceShort, propfind } from 'tsdav'
import { expect, it } from 'vitest'
import { davHandler } from './mocks/dav'
import { server } from './mocks/server'

const url = 'http://caldav.test/dev/'

const multistatus = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dev/</d:href>
    <d:propstat>
      <d:prop><d:displayname>Personal</d:displayname></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`

it('answers a tsdav PROPFIND with a mocked multistatus response', async () => {
  server.use(davHandler('PROPFIND', url, multistatus))

  const [response] = await propfind({
    url,
    props: { [`${DAVNamespaceShort.DAV}:displayname`]: {} },
    depth: '0',
  })

  expect(response.ok).toBe(true)
  expect(response.props?.displayname).toBe('Personal')
})

it('fails on requests that have no handler', async () => {
  const error = await fetch('http://unmocked.test/').catch((reason: unknown) => reason)
  expect(error).toBeInstanceOf(Error)
  expect((error as Error).cause).toMatchObject({
    message: expect.stringContaining('onUnhandledFrame'),
  })
})
