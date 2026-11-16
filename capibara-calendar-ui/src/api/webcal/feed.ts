import ICAL from 'ical.js'
import { normalizeColor } from '../../lib/calendar-color'
import { HttpError } from '../../lib/errors'
import { parseCalendarFile, type Incoming } from '../../lib/ics-import'
import { proxyFetch } from '../../lib/proxy-fetch'
import { ApiError } from '../calendar-api'

const minRefreshMs = 5 * 60 * 1000

export type Feed = {
  stamp: string
  name?: string
  color?: string
  refreshMs?: number
  via: 'direct' | 'proxy'
  etag?: string
  modified?: string
  events: Incoming[]
}

export function feedUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim().replace(/^webcals?:/i, 'https:'))
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function stampOf(file: string) {
  const text = file.replace(/^DTSTAMP[^\r\n]*/gm, '')
  let hash = 5381
  for (let index = 0; index < text.length; index++) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0
  }
  return `${text.length}.${(hash >>> 0).toString(36)}`
}

function refreshOf(calendar: ICAL.Component) {
  const hint =
    calendar.getFirstPropertyValue('refresh-interval') ??
    calendar.getFirstPropertyValue('x-published-ttl')
  try {
    const duration =
      hint instanceof ICAL.Duration
        ? hint
        : typeof hint === 'string'
          ? ICAL.Duration.fromString(hint)
          : undefined
    const seconds = duration?.toSeconds() ?? 0
    return seconds > 0 ? Math.max(seconds * 1000, minRefreshMs) : undefined
  } catch {
    return undefined
  }
}

function headerOf(text: string) {
  const first = text.search(/^BEGIN:(?!VCALENDAR)/m)
  const head = `${first < 0 ? text : text.slice(0, first)}\r\nEND:VCALENDAR\r\n`
  try {
    const calendar = new ICAL.Component(ICAL.parse(head) as unknown[])
    const name =
      calendar.getFirstPropertyValue('x-wr-calname') ?? calendar.getFirstPropertyValue('name')
    return {
      name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
      color: normalizeColor(calendar.getFirstPropertyValue('x-apple-calendar-color')),
      refreshMs: refreshOf(calendar),
    }
  } catch {
    return {}
  }
}

async function download(url: string, kept?: Feed) {
  if (kept?.via !== 'proxy') {
    try {
      return { response: await fetch(url, { credentials: 'omit' }), via: 'direct' as const }
    } catch (error) {
      if (!(error instanceof TypeError)) throw error
    }
  }
  const headers = new Headers({ accept: 'text/calendar' })
  if (kept?.etag) headers.set('if-none-match', kept.etag)
  if (kept?.modified) headers.set('if-modified-since', kept.modified)
  const response = await proxyFetch(url, { method: 'GET', headers })
  if (response.status === 403 && response.headers.has('x-caldav-proxy-error')) {
    throw new ApiError('forbidden', { message: 'The proxy does not allow this address' })
  }
  return { response, via: 'proxy' as const }
}

export async function readFeed(url: string, kept?: Feed): Promise<Feed> {
  const { response, via } = await download(url, kept)
  if (response.status === 304 && kept) return kept
  if (!response.ok) throw new HttpError(response.status)
  const text = await response.text()
  const { events, problems } = parseCalendarFile(text)
  if (problems.some(({ kind }) => kind === 'file')) {
    throw new ApiError('unknown', { message: 'Not a calendar file' })
  }
  return {
    stamp: stampOf(text),
    via,
    etag: response.headers.get('etag') ?? undefined,
    modified: response.headers.get('last-modified') ?? undefined,
    events,
    ...headerOf(text),
  }
}
