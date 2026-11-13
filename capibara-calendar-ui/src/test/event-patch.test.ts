import { describe, expect, it } from 'vitest'
import { contractOf } from './server'
import { eventPatchOf, formValuesOf } from '../lib/event-form'
import type { EventFormValues } from '../lib/event-schema'
import type { CalendarEvent } from './legacy'

const appZone = 'Europe/Rome'
const options = { appZone }

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
  endTime: '10:00',
  location: 'Room 4',
}

/** The form as it is opened for an event, and the one that the person ends with, after these changes. */
function edit(changes: Partial<EventFormValues>, base: CalendarEvent = legacy) {
  const event = contractOf(base)
  const initial = {
    ...formValuesOf(event, options),
    repeat: '',
    repeatDays: [],
    alerts: [],
    participants: [],
    status: 'confirmed',
    eventColor: '',
  } as EventFormValues
  return eventPatchOf({ ...initial, ...changes }, initial, event, options)
}

describe('what the person changed in the form', () => {
  it('is all that is in the patch: the place alone, and nothing when nothing was touched', () => {
    expect(edit({})).toEqual({})
    expect(edit({ location: 'Room 5' })).toEqual({ locations: [{ name: 'Room 5' }] })
    expect(edit({ location: '' })).toEqual({ locations: [] })
  })

  it('has the days and times together, whichever of them was touched', () => {
    expect(edit({ endTime: '11:30' })).toMatchObject({
      start: '2026-11-12T09:00:00',
      duration: 'PT2H30M',
      showWithoutTime: false,
    })
    expect(Object.keys(edit({ endTime: '11:30' })).sort()).toEqual([
      'duration',
      'showWithoutTime',
      'start',
      'timeZone',
    ])
  })

  it('has the answers of the participants that were added, changed or taken out, and no others', () => {
    const base = { ...legacy, participants: undefined }
    expect(edit({ participants: [{ id: 'urn:uuid:a', status: 'accepted' }] }, base)).toEqual({
      participants: { set: [{ id: 'urn:uuid:a', status: 'accepted' }], remove: [] },
    })
  })

  it('keeps the alerts that the form cannot show, when the others change', () => {
    const patch = edit({ alerts: ['15'] })
    expect(patch.alerts).toEqual([
      { trigger: { type: 'offset', offset: '-PT15M', relativeTo: 'start' } },
    ])
  })
})
