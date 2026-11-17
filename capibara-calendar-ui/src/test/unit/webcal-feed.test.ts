import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { feedUrl, readFeed } from '@/api/webcal/feed'

const address = 'https://feeds.example/holidays.ics'

const event = (uid: string, title: string, stamp = '20261112T080000Z') => [
  'BEGIN:VEVENT',
  `UID:${uid}@feeds.example`,
  `DTSTAMP:${stamp}`,
  'DTSTART:20261112T090000Z',
  'DTEND:20261112T100000Z',
  `SUMMARY:${title}`,
  'END:VEVENT',
]

const calendar = (head: string[] = [], events = [event('1', 'Dentist')]) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//test//EN',
    ...head,
    ...events.flat(),
    'END:VCALENDAR',
  ].join('\r\n')

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const blocked = () => new TypeError('Failed to fetch') // what the browser says when CORS does not let it

describe('the address of a feed', () => {
  it('reads webcal and webcals as https', () => {
    // then
    expect(feedUrl('webcal://feeds.example/a.ics')).toBe('https://feeds.example/a.ics')
    expect(feedUrl(' WEBCALS://feeds.example/a.ics ')).toBe('https://feeds.example/a.ics')
  })

  it('keeps http and https as they are', () => {
    // then
    expect(feedUrl('http://feeds.example/a.ics')).toBe('http://feeds.example/a.ics')
    expect(feedUrl('https://feeds.example/a.ics')).toBe('https://feeds.example/a.ics')
  })

  it('is nothing for what is not an address on the network', () => {
    // then
    for (const value of [
      '',
      'feeds.example/a.ics',
      'ftp://feeds.example/a.ics',
      'not an address',
    ]) {
      expect(feedUrl(value)).toBeUndefined()
    }
  })
})

describe('reading a feed', () => {
  it('reads the GEO of its events as the coordinates of their place', async () => {
    // given
    const located = event('1', 'Party')
    located.splice(
      5,
      0,
      'LOCATION:Genova - Villa Groppallo',
      'GEO:44.38221763037996;9.04328792627319',
    )
    fetchMock.mockResolvedValue(new Response(calendar([], [located, event('2', 'Meeting')])))

    // when
    const feed = await readFeed(address)

    // then
    const [party, meeting] = feed.events.map(({ resource }) => resource.event.locations)
    expect(party).toEqual([
      {
        name: 'Genova - Villa Groppallo',
        coordinates: { latitude: 44.38221763037996, longitude: 9.04328792627319 },
      },
    ])
    expect(meeting).toEqual([])
  })

  it('reads its events, and what the feed says of itself', async () => {
    // given
    fetchMock.mockResolvedValue(
      new Response(
        calendar(
          ['X-WR-CALNAME:Holidays', 'X-APPLE-CALENDAR-COLOR:#2563EB'],
          [event('1', 'New Year'), event('2', 'Easter')],
        ),
      ),
    )

    // when
    const feed = await readFeed(address)

    // then
    expect(feed.events.map(({ uid }) => uid)).toEqual(['1@feeds.example', '2@feeds.example'])
    expect(feed.name).toBe('Holidays')
    expect(feed.color).toBe('#2563eb')
    expect(feed.via).toBe('direct')
  })

  it('has no name and no color when the feed does not say them', async () => {
    // given
    fetchMock.mockResolvedValue(new Response(calendar()))

    // when
    const feed = await readFeed(address)

    // then
    expect(feed.name).toBeUndefined()
    expect(feed.color).toBeUndefined()
  })

  it('reads how often the feed changes, and not less than 5 minutes', async () => {
    // given
    const refreshOf = async (...head: string[]) => {
      fetchMock.mockResolvedValueOnce(new Response(calendar(head)))
      return (await readFeed(address)).refreshMs
    }

    // then
    expect(await refreshOf('X-PUBLISHED-TTL:PT1H')).toBe(60 * 60 * 1000)
    expect(await refreshOf('REFRESH-INTERVAL;VALUE=DURATION:P1D')).toBe(24 * 60 * 60 * 1000)
    expect(await refreshOf('X-PUBLISHED-TTL:PT1M')).toBe(5 * 60 * 1000)
    expect(await refreshOf()).toBeUndefined()
  })

  it('has the same stamp when only the DTSTAMP changes, and another when the events change', async () => {
    // given
    const stampOf = async (text: string) => {
      fetchMock.mockResolvedValueOnce(new Response(text))
      return (await readFeed(address)).stamp
    }

    // when
    const first = await stampOf(calendar([], [event('1', 'Dentist', '20261112T080000Z')]))
    const later = await stampOf(calendar([], [event('1', 'Dentist', '20261112T091500Z')]))
    const changed = await stampOf(calendar([], [event('1', 'Dentist at noon')]))

    // then
    expect(later).toBe(first)
    expect(changed).not.toBe(first)
  })

  it('says that the file is not a calendar', async () => {
    // given
    fetchMock.mockResolvedValue(new Response('<html><body>Not here</body></html>'))

    // then
    await expect(readFeed(address)).rejects.toThrow('Not a calendar file')
  })

  it('fails with what the address answers when it does not give the file', async () => {
    // given
    fetchMock.mockResolvedValue(new Response('', { status: 404 }))

    // then
    await expect(readFeed(address)).rejects.toMatchObject({ status: 404 })
  })
})

describe('reading a feed through the proxy', () => {
  const proxied = (init: ResponseInit = {}) => {
    fetchMock.mockRejectedValueOnce(blocked())
    fetchMock.mockResolvedValueOnce(
      new Response(calendar(), {
        headers: { etag: '"v1"', 'last-modified': 'Thu, 12 Nov 2026 08:00:00 GMT' },
        ...init,
      }),
    )
  }

  it('goes through the proxy when the browser is not let to read the feed, and keeps what the server says of the file', async () => {
    // given
    proxied()

    // when
    const feed = await readFeed(address)

    // then
    expect(feed.via).toBe('proxy')
    expect(feed.etag).toBe('"v1"')
    expect(feed.modified).toBe('Thu, 12 Nov 2026 08:00:00 GMT')
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/caldav')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('x-caldav-target')).toBe(address)
  })

  it('asks the proxy if the file changed, and keeps the feed that it has when it did not', async () => {
    // given
    proxied()
    const kept = await readFeed(address)
    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }))

    // when
    const again = await readFeed(address, kept)

    // then
    expect(again).toBe(kept)
    expect(fetchMock).toHaveBeenCalledOnce() // it did not try the browser again
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers)
    expect(headers.get('if-none-match')).toBe('"v1"')
    expect(headers.get('if-modified-since')).toBe('Thu, 12 Nov 2026 08:00:00 GMT')
  })

  it('reads the file again when the proxy says that it changed', async () => {
    // given
    proxied()
    const kept = await readFeed(address)
    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(
      new Response(calendar([], [event('1', 'Dentist at noon')]), { headers: { etag: '"v2"' } }),
    )

    // when
    const again = await readFeed(address, kept)

    // then
    expect(again).not.toBe(kept)
    expect(again.etag).toBe('"v2"')
    expect(again.stamp).not.toBe(kept.stamp)
  })

  it('does not ask a feed that the browser reads if the file changed: it reads it whole', async () => {
    // given
    fetchMock.mockResolvedValueOnce(new Response(calendar(), { headers: { etag: '"v1"' } }))
    const kept = await readFeed(address)
    fetchMock.mockResolvedValueOnce(new Response(calendar()))

    // when
    await readFeed(address, kept)

    // then
    expect(fetchMock.mock.calls[1]).toEqual([address, { credentials: 'omit' }])
  })

  it('says that the proxy does not allow the address', async () => {
    // given
    fetchMock.mockRejectedValueOnce(blocked())
    fetchMock.mockResolvedValueOnce(
      new Response('This server cannot be talked to', {
        status: 403,
        headers: { 'x-caldav-proxy-error': 'true' },
      }),
    )

    // then
    await expect(readFeed(address)).rejects.toMatchObject({ kind: 'forbidden' })
  })
})
