import { t } from '@lingui/core/macro'
import { isEqual } from 'es-toolkit'
import { formatDay } from '../../lib/format'
import { eventKey, timeZoneId, type SourceId } from '../calendar-api'
import { displayTimes } from '../shared/zones'
import type { StoredCalendar, StoredEvent } from '../stored-documents'

/**
 * What the chat is told when this device changes something, and who is told.
 *
 * - `notify`: a notification for each attendee of an event, with all the details. Nobody else.
 * - `info`: a line in the chat that everybody reads, shorter than the notification. For the events
 *   that have attendees, and for the calendars. An event without attendees involves nobody, so it is
 *   quiet: nothing is told.
 * - `href`: opens the event, when the chat is opened from the update. It is there whenever an event is
 *   involved, and a line that is not for an event has the time as its link, only to be kept: the chat
 *   replaces a line with the next one of the same author, unless it has a link.
 *
 * Each text says who did it, and puts the names of the things in quotes, as “Parties”: what is between
 * the quotes is a value, and the rest is the wording. The texts are in the language of the author, as
 * the times are in their time zone: they are written when the change is made, and sent as they are.
 */

/** What this device changed: the row as it was, and as it is. Without the first one it was created. */
export type ChatChange =
  | { kind: 'event'; before?: StoredEvent; after?: StoredEvent }
  | { kind: 'calendar'; before?: StoredCalendar; after?: StoredCalendar }

type Context = {
  /** The name of the author, that starts the texts. The author is told too, as the others. */
  author: string
  /** The people of the chat that are known: their address and their name. */
  people: ReadonlyMap<string, string>
  sourceId: SourceId
  /** The language of the author, for the times and the lists. */
  locale: string
  /** The time zone of the author, for the times. */
  timeZone: string
  /** The moment of the update, in milliseconds. */
  now: number
}

type Outcome = {
  /** The notification, with all the details. */
  text: string
  /** The addresses that get it. */
  to: string[]
  /** The line of the chat, when there is one. */
  info?: string
}

/** The whole start of an event, in the language and the time zone of the author, without the name of the zone. */
function when({ event }: StoredEvent, { locale, timeZone }: Context) {
  const { startDate, startTime } = displayTimes(event, timeZoneId(timeZone))
  const day = Temporal.PlainDate.from(startDate)
  const dayStyle = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } as const
  if (!startTime) return formatDay(day, locale, dayStyle)
  return day
    .toPlainDateTime(startTime)
    .toZonedDateTime(timeZone)
    .toLocaleString(locale, {
      ...dayStyle,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
}

const attendeesOf = ({ event }: StoredEvent) => event.participants.map(({ id }) => String(id))
const placeOf = ({ event }: StoredEvent) => event.locations.at(0)?.name ?? ''

/** The names of the people that are known, as a list of the language of the author: "Luca, Anna and Bruno". */
function namesOf(addresses: string[], { people, locale }: Context) {
  const names = addresses.flatMap((address) => people.get(address) ?? [])
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
}

/** What changed in an event, for the attendees that were there, or nothing when it is not worth it. */
function whatChanged(before: StoredEvent, after: StoredEvent, context: Context) {
  const who = context.author
  const title = after.event.title
  const [was, now] = [before.event, after.event]
  const isMoved =
    was.start !== now.start ||
    was.timeZone !== now.timeZone ||
    was.showWithoutTime !== now.showWithoutTime

  if (was.status !== now.status && now.status === 'cancelled') {
    const time = when(before, context)
    return t`${who} cancelled “${title}”, planned for ${time}`
  }

  const parts: string[] = []
  if (was.status !== now.status) {
    parts.push(now.status === 'tentative' ? t`status: tentative` : t`status: confirmed`)
  }
  if (isMoved) {
    const [wasTime, nowTime] = [when(before, context), when(after, context)]
    parts.push(t`time from ${wasTime} to ${nowTime}`)
  }
  if (!isEqual(was.duration, now.duration)) parts.push(t`length changed`)
  if (was.title !== now.title) {
    const [wasTitle, nowTitle] = [was.title, now.title]
    parts.push(t`title from “${wasTitle}” to “${nowTitle}”`)
  }
  const [wasPlace, nowPlace] = [placeOf(before), placeOf(after)]
  if (wasPlace !== nowPlace) {
    if (wasPlace && nowPlace) parts.push(t`place from “${wasPlace}” to “${nowPlace}”`)
    else if (nowPlace) parts.push(t`place set to “${nowPlace}”`)
    else parts.push(t`place removed`)
  }
  if (!isEqual(was.virtualLocations, now.virtualLocations)) parts.push(t`video link changed`)
  if (!isEqual(was.recurrenceRules, now.recurrenceRules)) parts.push(t`repeat changed`)
  if (before.calendarId !== after.calendarId) parts.push(t`moved to another calendar`)

  // The description, the tags, the alerts, the color and the answers are not told.
  if (parts.length === 0) {
    return isEqual(before.recurrenceOverrides, after.recurrenceOverrides)
      ? undefined
      : t`${who} changed one repeat of “${title}”`
  }
  if (parts.length === 1 && isMoved) {
    const [wasTime, nowTime] = [when(before, context), when(after, context)]
    return t`${who} rescheduled “${title}” from ${wasTime} to ${nowTime}`
  }
  const details = parts.join('; ')
  return t`${who} changed “${title}”: ${details}`
}

/**
 * The notifications for the people that an event is added to. Each one has their own text, with the
 * others that are there; the chat has one line for all of them.
 */
function addedOutcomes(
  newcomers: string[],
  event: StoredEvent,
  isNew: boolean,
  context: Context,
): Outcome[] {
  const who = context.author
  const title = event.event.title
  const everybody = attendeesOf(event)
  const names = namesOf(newcomers, context)
  const allNames = namesOf(everybody, context)
  let info: string
  if (isNew)
    info = allNames ? t`${who} created “${title}” with ${allNames}` : t`${who} created “${title}”`
  else info = names ? t`${who} added ${names} to “${title}”` : t`${who} added people to “${title}”`

  const place = placeOf(event)
  return newcomers.map((address, index) => {
    const others = namesOf(
      everybody.filter((other) => other !== address),
      context,
    )
    const details = [
      when(event, context),
      ...(place ? [t`at “${place}”`] : []),
      ...(others ? [t`with ${others}`] : []),
    ].join(', ')
    const text = t`${who} added you to “${title}”: ${details}`
    return { text, to: [address], info: index === 0 ? info : undefined }
  })
}

/** An event that has no attendees involves nobody, so it is quiet. The ones that have them tell them. */
function eventOutcomes(
  before: StoredEvent | undefined,
  after: StoredEvent | undefined,
  context: Context,
): Outcome[] {
  const who = context.author
  if (!before) {
    const attendees = after ? attendeesOf(after) : []
    return after && attendees.length > 0 ? addedOutcomes(attendees, after, true, context) : []
  }
  const title = before.event.title
  if (!after) {
    const attendees = attendeesOf(before)
    if (attendees.length === 0) return []
    const time = when(before, context)
    const text = t`${who} deleted “${title}”, planned for ${time}`
    return [{ text, to: attendees, info: t`${who} deleted “${title}”` }]
  }

  const attendees = attendeesOf(after)
  if (attendees.length === 0) return []
  const newcomers = attendees.filter((address) => !attendeesOf(before).includes(address))
  const outcomes = newcomers.length > 0 ? addedOutcomes(newcomers, after, false, context) : []
  const text = whatChanged(before, after, context)
  if (text) {
    const others = attendees.filter((address) => !newcomers.includes(address))
    const newTitle = after.event.title
    const short = t`${who} changed “${newTitle}”`
    outcomes.push({ text, to: others, info: short })
  }
  return outcomes
}

function calendarOutcomes(
  before: StoredCalendar | undefined,
  after: StoredCalendar | undefined,
  context: Context,
): Outcome[] {
  const who = context.author
  // A calendar has no attendees: nobody is notified, and the chat has the line, that everybody reads.
  if (!before && after) {
    const name = after.name
    const text = t`${who} created a new calendar: “${name}”`
    return [{ text, to: [], info: text }]
  }
  if (before && !after) {
    const name = before.name
    const text = t`${who} deleted the calendar “${name}”`
    return [{ text, to: [], info: text }]
  }
  if (before && after && before.name !== after.name) {
    const [was, now] = [before.name, after.name]
    const text = t`${who} renamed the calendar “${was}” to “${now}”`
    return [{ text, to: [], info: text }]
  }
  return [] // the color and the order are not told
}

/** The first row as it was and the last as it is, for what was changed more than once. */
function merged(changes: ChatChange[]) {
  const byRow = new Map<string, ChatChange>()
  for (const change of changes) {
    const row = change.after ?? change.before
    const key = `${change.kind} ${row?.id ?? ''}`
    const first = byRow.get(key)
    byRow.set(key, first ? ({ ...first, after: change.after } as ChatChange) : change)
  }
  return [...byRow.values()]
}

const several = (texts: string[]) => {
  const first = texts[0]
  const others = texts.length - 1
  return others === 0 ? first : t`${first} (and ${others} more)`
}

/** The link to the first event of the changes that is still there: the update has it whenever an event is involved. */
function linkOf(changes: ChatChange[], context: Context) {
  for (const change of changes) {
    if (change.kind !== 'event' || !change.after) continue
    const { calendarId, id } = change.after
    const key = eventKey({ sourceId: context.sourceId, calendarId, eventId: id })
    return `index.html#event=${encodeURIComponent(key)}`
  }
  return undefined
}

/** What is added to the update that tells the chat of the changes, or nothing when there is nothing to add. */
export function notificationsOf(changes: ChatChange[], context: Context) {
  const rows = merged(changes)
  const outcomes = rows.flatMap((change) =>
    change.kind === 'event'
      ? eventOutcomes(change.before, change.after, context)
      : calendarOutcomes(change.before, change.after, context),
  )
  const texts = new Map<string, string[]>()
  for (const { text, to } of outcomes) {
    for (const address of to) {
      const told = texts.get(address) ?? []
      if (!told.includes(text)) told.push(text)
      texts.set(address, told)
    }
  }
  const notify = Object.fromEntries([...texts].map(([address, told]) => [address, several(told)]))

  const lines = outcomes.flatMap(({ info }) => (info ? [info] : []))
  const who = context.author
  const count = lines.length
  const info = count === 0 ? undefined : count === 1 ? lines[0] : t`${who} made ${count} changes`
  // The chat replaces a line with the next one of the same author, unless it has a link: a line that
  // is not for an event gets the time as its link, only to be kept.
  const href = linkOf(rows, context) ?? (info ? `index.html#${context.now}` : undefined)

  if (Object.keys(notify).length === 0 && !info && !href) return undefined
  return {
    ...(info ? { info } : {}),
    ...(href ? { href } : {}),
    ...(Object.keys(notify).length > 0 ? { notify } : {}),
  }
}
