import { describe, expect, it } from 'vitest'
import { createEventSchema, type EventFormValues } from '@/lib/event-schema'

const valid: EventFormValues = {
  calendarUrl: '/personal/',
  title: 'Flight',
  description: '',
  startDate: '2026-11-12',
  startTime: '15:00',
  endDate: '',
  endTime: '16:00',
  timeZone: 'UTC',
  endTimeZone: 'UTC',
}

function errorsFor(values: Partial<EventFormValues>) {
  const result = createEventSchema().safeParse({ ...valid, ...values })
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]))
}

describe('the end of an event in another zone than its start', () => {
  it('is checked against the start by the instants, and not by the clock', () => {
    // given: 15:00 in UTC is 10:00 in New York, so 10:30 there is after it, and 09:30 is before it
    const after = { endTimeZone: 'America/New_York', endTime: '10:30' }
    const before = { endTimeZone: 'America/New_York', endTime: '09:30' }

    // when
    const afterErrors = errorsFor(after)
    const beforeErrors = errorsFor(before)

    // then
    expect(afterErrors).toEqual({})
    expect(beforeErrors).toEqual({ endTime: 'The end cannot be before the start' })
  })

  it('can be on an earlier date than the start, when its zone is behind', () => {
    // given: 02:00 of the 13th in Tokyo is 17:00 of the 12th in UTC, and 10:00 of the 12th in Los Angeles is 18:00
    const flight = {
      startDate: '2026-11-13',
      startTime: '02:00',
      timeZone: 'Asia/Tokyo',
      endDate: '2026-11-12',
      endTime: '10:00',
      endTimeZone: 'America/Los_Angeles',
    }

    // when
    const errors = errorsFor(flight)

    // then
    expect(errors).toEqual({})
  })

  it('is still checked by the clock when it is in the same zone as its start', () => {
    // given
    const sameZone = { endTimeZone: 'UTC', endTime: '14:00' }

    // when
    const errors = errorsFor(sameZone)

    // then
    expect(errors).toEqual({ endTime: 'The end cannot be before the start' })
  })
})
