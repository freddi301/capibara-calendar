import { describe, expect, it } from 'vitest'
import { timeZoneId, type ContactId } from '../api/calendar-api'
import { toDisplayEvent } from '../lib/display-event'
import { canMoveEvent, daysBetween, movePatch, shiftDate } from '../lib/move-event'
import { contractOf } from './server'
import type { CalendarEvent } from './legacy'

const appZone = 'Europe/Rome'

const legacy: CalendarEvent = {
  uid: '1',
  calendarUrl: '/c/',
  url: '/c/1.ics',
  ics: '',
  title: 'Planning',
  description: '',
  startDate: '2026-11-12',
  startTime: '09:00',
  endDate: '2026-11-12',
  endTime: '10:30',
}

const patchOf = (days: number, base: Partial<CalendarEvent> = {}) =>
  movePatch(contractOf({ ...legacy, ...base }), days, appZone)

describe('moving an event by some days', () => {
  it('moves the day and leaves the time and the length as they are', () => {
    expect(patchOf(3)).toEqual({
      start: '2026-11-15T09:00:00',
      timeZone: null,
      duration: 'PT1H30M',
      showWithoutTime: false,
    })
    expect(patchOf(-2)).toMatchObject({ start: '2026-11-10T09:00:00', duration: 'PT1H30M' })
  })

  it('has nothing to change when it is moved by no days', () => {
    expect(patchOf(0)).toEqual({})
  })

  it('goes over the end of a month and of a year', () => {
    expect(patchOf(20)).toMatchObject({ start: '2026-12-02T09:00:00' })
    expect(patchOf(50)).toMatchObject({ start: '2027-01-01T09:00:00' })
  })

  it('moves an event of a whole day, and the days that it lasts go with it', () => {
    const allDay = { startTime: '', endTime: '', endDate: '' }
    expect(patchOf(1, allDay)).toMatchObject({
      start: '2026-11-13T00:00:00',
      duration: 'P1D',
      showWithoutTime: true,
    })
    const long = { startTime: '', endTime: '', endDate: '2026-11-14' }
    expect(patchOf(2, long)).toMatchObject({
      start: '2026-11-14T00:00:00',
      duration: 'P3D',
      showWithoutTime: true,
    })
  })

  it('moves an event that goes over midnight, with the day that it ends on', () => {
    const night = { startTime: '22:00', endDate: '2026-11-13', endTime: '02:00' }
    expect(patchOf(1, night)).toMatchObject({ start: '2026-11-13T22:00:00', duration: 'PT4H' })
  })

  it('keeps the time zone that the event has, and the time in it', () => {
    expect(patchOf(1, { timeZone: 'America/New_York' })).toMatchObject({
      start: '2026-11-13T09:00:00',
      timeZone: 'America/New_York',
      duration: 'PT1H30M',
    })
  })

  it('does not touch anything else of the event', () => {
    const patch = patchOf(1, { location: 'Room 4', description: 'Notes' })
    expect(Object.keys(patch).sort()).toEqual(['duration', 'showWithoutTime', 'start', 'timeZone'])
  })
})

describe('the days between two dates', () => {
  it('counts them, forward and back', () => {
    expect(daysBetween('2026-11-12', '2026-11-15')).toBe(3)
    expect(daysBetween('2026-11-15', '2026-11-12')).toBe(-3)
    expect(daysBetween('2026-11-12', '2026-11-12')).toBe(0)
    expect(daysBetween('2026-11-29', '2026-12-02')).toBe(3)
  })

  it('shifts a date, and leaves an empty one empty', () => {
    expect(shiftDate('2026-11-29', 3)).toBe('2026-12-02')
    expect(shiftDate('', 3)).toBe('')
  })
})

describe('which events can be dragged to another day', () => {
  const plain = () => toDisplayEvent(contractOf(legacy), timeZoneId(appZone))

  it('is a plain event, in a calendar that can be changed', () => {
    expect(canMoveEvent(plain())).toBe(true)
    expect(canMoveEvent(plain(), { create: true, update: true, remove: true })).toBe(true)
  })

  it('is not a repeating event, nor one of the days that were changed of it', () => {
    expect(canMoveEvent({ ...plain(), isRecurring: true })).toBe(false)
    const one = plain()
    const changedDay = {
      ...one,
      source: { ...one.source, ref: { ...one.source.ref, recurrenceId: '2026-11-12T09:00:00' } },
    } as typeof one
    expect(canMoveEvent(changedDay)).toBe(false)
  })

  it('is not an event that is somebody else’s invitation', () => {
    const one = plain()
    const invited = {
      ...one,
      source: { ...one.source, organizer: 'urn:uuid:boss' as ContactId },
    }
    expect(canMoveEvent(invited)).toBe(false)
  })

  it('is not an event of a calendar that cannot be changed', () => {
    expect(canMoveEvent(plain(), { create: true, update: false, remove: false })).toBe(false)
  })
})
