import { describe, expect, it } from 'vitest'
import { eventValuesOf, formValuesOf } from '@/lib/event-form'
import type { EventFormValues } from '@/lib/event-schema'
import { contractOf } from '@/test/server'
import { dentist } from '@/test/support/app'

const appZone = 'Europe/Rome'

/** The event as the form of it was filled in, and stored. */
const stored = (changes: Partial<EventFormValues>) =>
  contractOf({ ...dentist, startTime: '15:00', endTime: '15:30', ...changes })

const form = (changes: Partial<EventFormValues>): EventFormValues => ({
  calendarUrl: '/personal/',
  title: 'Flight',
  description: '',
  startDate: '2026-11-12',
  startTime: '15:00',
  endDate: '',
  endTime: '15:30',
  timeZone: 'UTC',
  endTimeZone: 'UTC',
  ...changes,
})

describe('the form of an event, when it is opened', () => {
  it('has the times in UTC as they are, and not in the zone of the app', () => {
    // given
    const event = stored({ timeZone: 'UTC', endTimeZone: 'UTC' })

    // when
    const values = formValuesOf(event, { appZone })

    // then
    expect(values).toMatchObject({
      startTime: '15:00',
      endTime: '15:30',
      timeZone: 'UTC',
      endTimeZone: 'UTC',
    })
  })

  it('has the start in its zone and the end in its own, when they are not the same', () => {
    // given: 15:00 in UTC is 10:00 in New York, and the event lasts 5 h 30 min
    const event = stored({ timeZone: 'UTC', endTimeZone: 'America/New_York' })

    // when
    const values = formValuesOf(event, { appZone })

    // then
    expect(values).toMatchObject({
      startTime: '15:00',
      timeZone: 'UTC',
      endTime: '15:30',
      endTimeZone: 'America/New_York',
    })
  })

  it('has the end in the zone of the start when the event has no zone for its end', () => {
    // given
    const event = stored({ timeZone: 'Asia/Tokyo', endTimeZone: 'Asia/Tokyo' })

    // when
    const values = formValuesOf(event, { appZone })

    // then
    expect(values).toMatchObject({ timeZone: 'Asia/Tokyo', endTimeZone: 'Asia/Tokyo' })
  })
})

describe('the event that is made from the form', () => {
  it('has no zone for its end when it is the zone of its start', () => {
    // given
    const filled = form({ timeZone: 'UTC', endTimeZone: 'UTC' })

    // when
    const values = eventValuesOf(filled, undefined, { appZone })

    // then
    expect(values).toMatchObject({ timeZone: 'UTC', endTimeZone: null, duration: 'PT30M' })
  })

  it('has the zone of its end and the time that passes between the two zones', () => {
    // given: 15:00 in UTC to 15:30 in New York, which is 20:30 in UTC
    const filled = form({ timeZone: 'UTC', endTimeZone: 'America/New_York' })

    // when
    const values = eventValuesOf(filled, undefined, { appZone })

    // then
    expect(values).toMatchObject({
      timeZone: 'UTC',
      endTimeZone: 'America/New_York',
      duration: 'PT5H30M',
    })
  })

  it('has no zone at all for its end when it is floating, or has no end time, or lasts all day', () => {
    // given
    const floating = form({ timeZone: '', endTimeZone: 'America/New_York' })
    const noEnd = form({ endTime: '', endTimeZone: 'America/New_York' })
    const allDay = form({ startTime: '', endTime: '', endTimeZone: 'America/New_York' })

    // when
    const [one, two, three] = [floating, noEnd, allDay].map((filled) =>
      eventValuesOf(filled, undefined, { appZone }),
    )

    // then
    expect(one).toMatchObject({ timeZone: null, endTimeZone: null })
    expect(two).toMatchObject({ timeZone: 'UTC', endTimeZone: null })
    expect(three).toMatchObject({ timeZone: null, endTimeZone: null })
  })
})
