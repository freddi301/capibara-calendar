import { describe, expect, it } from 'vitest'
import { duration, localDateTime, timeZoneId, type EventValues } from '@/api/calendar-api'
import { originalTimes, shiftedDuration } from '@/api/shared/zones'
import { timeInZone } from '@/lib/zone-choice'

const appZone = timeZoneId('Europe/Rome')

const timing = (
  changes: Partial<
    Pick<EventValues, 'start' | 'timeZone' | 'endTimeZone' | 'duration' | 'showWithoutTime'>
  >,
) => ({
  start: localDateTime('2026-11-12T09:00:00'),
  timeZone: appZone,
  endTimeZone: null,
  duration: duration('PT1H'),
  showWithoutTime: false,
  ...changes,
})

describe('the times of an event in its own zones', () => {
  it('are not told when the event is in the zone of the app, is all day, or is floating', () => {
    // given
    const inApp = timing({})
    const allDay = timing({ showWithoutTime: true, timeZone: null })
    const floating = timing({ timeZone: null })

    // when
    const found = [inApp, allDay, floating].map((values) => originalTimes(values, appZone))

    // then
    expect(found).toEqual([undefined, undefined, undefined])
  })

  it('are the start and the end in UTC, when the whole event is', () => {
    // given
    const values = timing({ timeZone: timeZoneId('UTC'), duration: duration('PT1H30M') })

    // when
    const found = originalTimes(values, appZone)

    // then
    expect(found).toEqual({
      start: { date: '2026-11-12', time: '09:00', zone: 'UTC' },
      end: { date: '2026-11-12', time: '10:30', zone: 'UTC' },
    })
  })

  it('are only the sides that are not in the zone of the app', () => {
    // given: it starts in Rome, and ends in New York
    const values = timing({
      start: localDateTime('2026-11-12T10:00:00'),
      endTimeZone: timeZoneId('America/New_York'),
      duration: duration('PT8H30M'),
    })

    // when
    const found = originalTimes(values, appZone)

    // then
    expect(found).toEqual({
      start: undefined,
      end: { date: '2026-11-12', time: '12:30', zone: 'America/New_York' },
    })
  })

  it('keep their own day, when the zone of the app is on another day', () => {
    // given: 11:00 in Auckland is the evening before in Rome
    const values = timing({
      start: localDateTime('2026-11-12T11:00:00'),
      timeZone: timeZoneId('Pacific/Auckland'),
    })

    // when
    const found = originalTimes(values, appZone)

    // then
    expect(found?.start).toEqual({ date: '2026-11-12', time: '11:00', zone: 'Pacific/Auckland' })
    expect(found?.end).toEqual({ date: '2026-11-12', time: '12:00', zone: 'Pacific/Auckland' })
  })

  it('have no end when the event has no length', () => {
    // given
    const values = timing({ timeZone: timeZoneId('UTC'), duration: duration('PT0S') })

    // when
    const found = originalTimes(values, appZone)

    // then
    expect(found).toEqual({
      start: { date: '2026-11-12', time: '09:00', zone: 'UTC' },
      end: undefined,
    })
  })
})

describe('the length between a start and an end in two zones', () => {
  const at = (day: string) => localDateTime(day)

  it('is the time that passes between the two instants', () => {
    // given: 15:00 in UTC to 15:30 in New York, which is 20:30 in UTC
    const zones = { start: timeZoneId('UTC'), end: timeZoneId('America/New_York') }

    // when
    const length = shiftedDuration(
      at('2026-11-12T15:00:00'),
      at('2026-11-12T15:30:00'),
      zones,
      appZone,
    )

    // then
    expect(length).toBe('PT5H30M')
  })

  it('goes over the day, when the end is the day before in its own zone', () => {
    // given: 22:00 in Tokyo to 16:00 in Los Angeles, on the same date
    const zones = { start: timeZoneId('Asia/Tokyo'), end: timeZoneId('America/Los_Angeles') }

    // when
    const length = shiftedDuration(
      at('2026-11-12T22:00:00'),
      at('2026-11-12T16:00:00'),
      zones,
      appZone,
    )

    // then
    expect(length).toBe('PT11H')
  })

  it('is as written in one zone, when the end has none of its own, or the event is floating', () => {
    // given
    const same = { start: timeZoneId('Asia/Tokyo'), end: null }
    const floating = { start: null, end: null }

    // when
    const inOne = shiftedDuration(
      at('2026-11-12T09:00:00'),
      at('2026-11-12T10:30:00'),
      same,
      appZone,
    )
    const inNone = shiftedDuration(
      at('2026-11-12T09:00:00'),
      at('2026-11-12T10:30:00'),
      floating,
      appZone,
    )

    // then
    expect(inOne).toBe('PT1H30M')
    expect(inNone).toBe('PT1H30M')
  })
})

describe('a time of the form in the zone that it is told in', () => {
  it('is the same instant on the clock of the other zone, with the day when it is not the same', () => {
    // given
    const day = '2026-11-12'

    // when
    const sameDay = timeInZone('UTC', 'Europe/Rome', day, '09:00')
    const dayBefore = timeInZone('Pacific/Auckland', 'Europe/Rome', day, '11:00')

    // then
    expect(sameDay).toEqual({ date: '2026-11-12', time: '10:00', isOtherDay: false })
    expect(dayBefore).toEqual({ date: '2026-11-11', time: '23:00', isOtherDay: true })
  })

  it('is nothing when the zones are the same, a zone is floating, or the time is not typed yet', () => {
    // given
    const day = '2026-11-12'

    // when
    const found = [
      timeInZone('Europe/Rome', 'Europe/Rome', day, '09:00'),
      timeInZone('', 'Europe/Rome', day, '09:00'),
      timeInZone('UTC', '', day, '09:00'),
      timeInZone('UTC', 'Europe/Rome', day, ''),
      timeInZone('UTC', 'Europe/Rome', '', '09:00'),
    ]

    // then
    expect(found).toEqual([undefined, undefined, undefined, undefined, undefined])
  })
})
