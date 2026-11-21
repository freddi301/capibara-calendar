// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { escapeXml, failedStatus, mkcalendarBody, proppatchBody } from '@/lib/calendar-xml'

describe('xml text', () => {
  it('has no character that is part of the markup', () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;',
    )
    expect(escapeXml('Lavoro')).toBe('Lavoro')
  })
})

describe('the request to make a calendar', () => {
  const body = mkcalendarBody({ name: 'Work & play', color: '#2563eb' })

  it('has the name and the color, the color as the servers write it, in capitals', () => {
    expect(body).toContain('<d:displayname>Work &amp; play</d:displayname>')
    expect(body).toContain('<ic:calendar-color>#2563EB</ic:calendar-color>')
  })

  it('is for a calendar of events, in the namespaces of CalDAV and of the color', () => {
    expect(body).toContain('<c:mkcalendar')
    expect(body).toContain('<c:comp name="VEVENT"/>')
    expect(body).toContain('xmlns:c="urn:ietf:params:xml:ns:caldav"')
    expect(body).toContain('xmlns:ic="http://apple.com/ns/ical/"')
    expect(body.startsWith('<?xml')).toBe(true)
  })

  it('is a document that can be read', () => {
    const document = new DOMParser().parseFromString(body, 'application/xml')
    expect(document.querySelector('parsererror')).toBeNull()
  })
})

describe('the request to change a calendar', () => {
  it('sets the name and the color, and nothing else', () => {
    const body = proppatchBody({ name: '<b>Casa</b>', color: '#dc2626' })

    expect(body).toContain('<d:propertyupdate')
    expect(body).toContain('<d:displayname>&lt;b&gt;Casa&lt;/b&gt;</d:displayname>')
    expect(body).toContain('<ic:calendar-color>#DC2626</ic:calendar-color>')
    expect(body).not.toContain('mkcalendar')
    expect(
      new DOMParser().parseFromString(body, 'application/xml').querySelector('parsererror'),
    ).toBeNull()
  })
})

describe('the answer of a server to a change of several things', () => {
  const answer = (...statuses: string[]) =>
    `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/c/</d:href>${statuses
      .map((status) => `<d:propstat><d:prop/><d:status>${status}</d:status></d:propstat>`)
      .join('')}</d:response></d:multistatus>`

  it('has no failure when everything was done', () => {
    expect(failedStatus(answer('HTTP/1.1 200 OK', 'HTTP/1.1 200 OK'))).toBeUndefined()
    expect(failedStatus(answer('HTTP/1.1 204 No Content'))).toBeUndefined()
  })

  it('has the status of the first thing that was not done', () => {
    expect(failedStatus(answer('HTTP/1.1 200 OK', 'HTTP/1.1 403 Forbidden'))).toBe(403)
    expect(failedStatus(answer('HTTP/1.1 424 Failed Dependency', 'HTTP/1.1 500 Error'))).toBe(424)
  })

  it('reads the status whatever the prefix of the namespace is, and in an answer without one', () => {
    expect(failedStatus('<D:status>HTTP/1.1 409 Conflict</D:status>')).toBe(409)
    expect(failedStatus('<status>HTTP/1.1 404 Not Found</status>')).toBe(404)
    expect(failedStatus('')).toBeUndefined()
    expect(failedStatus('not xml')).toBeUndefined()
  })
})
