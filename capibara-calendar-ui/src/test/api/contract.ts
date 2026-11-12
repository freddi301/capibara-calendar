import { describe, expect, it } from 'vitest'
import {
  duration,
  isoDate,
  localDateTime,
  timeZoneId,
  type CalendarEvent,
  type CalendarRef,
  type CalendarSource,
  type EventValues,
  type ListOptions,
} from '../../api/calendar-api'

export const appZone = timeZoneId('Europe/Rome')
export const options: ListOptions = { timeZone: appZone }

export const eventValues = (changes: Partial<EventValues> = {}): EventValues => ({
  title: 'Event',
  description: '',
  start: localDateTime('2026-11-12T09:00:00'),
  timeZone: appZone,
  duration: duration('PT1H'),
  showWithoutTime: false,
  locations: [],
  virtualLocations: [],
  keywords: [],
  alerts: [],
  recurrenceRules: [],
  status: 'confirmed',
  color: null,
  ...changes,
})

const week = { start: isoDate('2026-11-09'), end: isoDate('2026-11-15') }
const month = { start: isoDate('2026-11-01'), end: isoDate('2026-11-30') }

const titles = (events: CalendarEvent[]) => events.map(({ title }) => title)

/** What every adapter has to do: the same tests run for each of them. */
export function describeContract(name: string, makeSource: () => Promise<CalendarSource>) {
  describe(`the contract of ${name}`, () => {
    async function setup() {
      const source = await makeSource()
      const calendar = await source.createCalendar({ name: 'Personal', color: '#2563eb' })
      return { source, calendar: calendar.ref }
    }

    it('makes, renames and deletes calendars', async () => {
      const { source, calendar } = await setup()
      expect((await source.listCalendars()).map(({ name }) => name)).toEqual(['Personal'])

      await source.updateCalendar(calendar, { name: 'Work' })
      expect((await source.listCalendars()).map(({ name }) => name)).toEqual(['Work'])

      await source.deleteCalendar(calendar)
      expect(await source.listCalendars()).toEqual([])
    })

    it('keeps an event with its own time zone, and lists it by the days of the range', async () => {
      const { source, calendar } = await setup()
      const zone = timeZoneId('America/New_York')
      await source.createEvent(calendar, eventValues({ title: 'Call', timeZone: zone }))
      await source.createEvent(
        calendar,
        eventValues({ title: 'Later', start: localDateTime('2026-12-01T10:00:00') }),
      )

      const events = await source.listEvents(calendar, week, options)

      expect(titles(events)).toEqual(['Call'])
      expect(events[0].timeZone).toBe(zone)
      expect(events[0].start).toBe('2026-11-12T09:00:00')
    })

    it('lists a whole-day event on each of its days', async () => {
      const { source, calendar } = await setup()
      await source.createEvent(
        calendar,
        eventValues({
          title: 'Trip',
          showWithoutTime: true,
          timeZone: null,
          start: localDateTime('2026-11-14T00:00:00'),
          duration: duration('P3D'),
        }),
      )

      expect(
        titles(
          await source.listEvents(
            calendar,
            { start: isoDate('2026-11-16'), end: isoDate('2026-11-16') },
            options,
          ),
        ),
      ).toEqual(['Trip'])
      expect(
        await source.listEvents(
          calendar,
          { start: isoDate('2026-11-17'), end: isoDate('2026-11-17') },
          options,
        ),
      ).toEqual([])
    })

    it('changes an event, and refuses a change that was made over the one of someone else', async () => {
      const { source, calendar } = await setup()
      const created = await source.createEvent(calendar, eventValues({ title: 'Dentist' }))

      const changed = await source.updateEvent(
        created,
        eventValues({ title: 'Dentist, later' }),
        'all',
      )
      expect(changed.title).toBe('Dentist, later')
      expect(changed.revision).not.toBe(created.revision)

      await expect(source.updateEvent(created, eventValues(), 'all')).rejects.toMatchObject({
        kind: 'conflict',
      })
      await expect(source.deleteEvent(created, 'all')).rejects.toMatchObject({ kind: 'conflict' })

      await source.deleteEvent(changed, 'all')
      expect(await source.listEvents(calendar, week, options)).toEqual([])
    })

    it('says that the calendar changed when an event does', async () => {
      const { source, calendar } = await setup()
      const before = await source.revision(calendar)
      await source.createEvent(calendar, eventValues())
      expect(await source.revision(calendar)).not.toBe(before)
    })

    it('moves an event to another calendar', async () => {
      const { source, calendar } = await setup()
      const other = (await source.createCalendar({ name: 'Other', color: '#dc2626' })).ref
      const created = await source.createEvent(calendar, eventValues())

      const moved = await (source.moveEvent
        ? source.moveEvent(created, other)
        : Promise.reject(new Error('Not supported')))

      expect(moved.ref.calendarId).toBe(other.calendarId)
      expect(await source.listEvents(calendar, week, options)).toEqual([])
      expect(titles(await source.listEvents(other, week, options))).toEqual(['Event'])
    })

    describe('events that repeat', () => {
      const weekly = eventValues({
        title: 'Standup',
        recurrenceRules: [{ frequency: 'weekly', count: 4 }],
      })

      async function repeating() {
        const { source, calendar } = await setup()
        await source.createEvent(calendar, weekly)
        const occurrences = await source.listEvents(calendar, month, options)
        return { source, calendar, occurrences }
      }

      const starts = (events: CalendarEvent[]) => events.map(({ start }) => start.slice(5, 10))

      it('are expanded, each with its own place in the series', async () => {
        const { occurrences } = await repeating()

        expect(starts(occurrences)).toEqual(['11-12', '11-19', '11-26', '12-03'].slice(0, 3))
        expect(occurrences[1].ref.recurrenceId).toBe('2026-11-19T09:00:00')
        expect(occurrences[1].series?.recurrenceRulesFromHere).toEqual([
          { frequency: 'weekly', count: 3 },
        ])
      })

      it('are changed for one occurrence only, or taken out one at a time', async () => {
        const { source, calendar, occurrences } = await repeating()

        const changed = await source.updateEvent(
          occurrences[1],
          eventValues({ title: 'Standup, moved', start: localDateTime('2026-11-19T11:00:00') }),
          'one',
        )
        expect(changed.title).toBe('Standup, moved')
        await source.deleteEvent((await source.listEvents(calendar, month, options))[2], 'one')

        const after = await source.listEvents(calendar, month, options)
        expect(titles(after)).toEqual(['Standup', 'Standup, moved'])
        expect(after[1].start).toBe('2026-11-19T11:00:00')
      })

      it('can be cancelled or tentative for one occurrence, which stays in the list', async () => {
        const { source, calendar } = await repeating()

        for (const [index, status] of [
          [1, 'cancelled'],
          [2, 'tentative'],
        ] as const) {
          const current = (await source.listEvents(calendar, month, options))[index]
          const { title, start } = current
          await source.updateEvent(current, eventValues({ title, start, status }), 'one')
        }

        const after = await source.listEvents(calendar, month, options)
        expect(after.map(({ status }) => status)).toEqual(['confirmed', 'cancelled', 'tentative'])
      })

      it('are split from an occurrence on, and the ones before stay as they are', async () => {
        const { source, calendar, occurrences } = await repeating()

        await source.updateEvent(
          occurrences[1],
          eventValues({
            title: 'Standup, later',
            start: occurrences[1].start,
            recurrenceRules: [{ frequency: 'weekly', count: 2 }],
          }),
          'following',
        )

        const after = await source.listEvents(calendar, month, options)
        expect(titles(after)).toEqual(['Standup', 'Standup, later', 'Standup, later'])
        await source.deleteEvent(after[1], 'following')
        expect(titles(await source.listEvents(calendar, month, options))).toEqual(['Standup'])
      })

      it('are changed all together, with the repeat rules that the form gave', async () => {
        const { source, calendar, occurrences } = await repeating()

        await source.updateEvent(
          occurrences[1],
          eventValues({
            title: 'Daily',
            recurrenceRules: [{ frequency: 'daily', interval: 2, count: 3 }],
          }),
          'all',
        )

        expect(starts(await source.listEvents(calendar, month, options))).toEqual([
          '11-12',
          '11-14',
          '11-16',
        ])
      })
    })
  })
}

export const calendarOf = (ref: CalendarRef) => ref
