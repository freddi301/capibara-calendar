import { describe, expect, it } from 'vitest'
import { contentOf, linesOf } from '@/lib/event-content'
import { defaultViewOptions } from '@/lib/use-stored'
import type { CalendarEvent } from '@/test/legacy'
import { displayOf } from '@/test/server'

const event = (fields: Partial<CalendarEvent> = {}) =>
  displayOf({
    uid: 'event',
    url: 'calendar',
    ics: '',
    calendarUrl: 'calendar',
    title: 'Standup',
    description: '',
    startDate: '2026-11-10',
    startTime: '09:00',
    endDate: '',
    endTime: '09:30',
    ...fields,
  })

const nothing = {
  calendar: false,
  tags: false,
  place: false,
  participants: false,
  description: false,
}

describe('the content of an event', () => {
  it('takes two lines when it has a time and a title, and nothing else', () => {
    // then
    expect(linesOf(event(), defaultViewOptions)).toBe(2)
  })

  it('takes a line for each row that the view shows and the event has', () => {
    // given
    const full = event({
      tags: 'work',
      location: 'Room 4',
      description: 'Bring the forms',
      participants: [{ id: 'ada', status: 'accepted' }],
    })

    // then: the time, the title, the tags, the place, the bar and the description
    expect(linesOf(full, defaultViewOptions)).toBe(6)
    // the calendar name is one more
    expect(linesOf(full, { ...defaultViewOptions, calendar: true })).toBe(7)
  })

  it('takes no line for a row that the view does not show, whatever the event has', () => {
    // given
    const full = event({
      tags: 'work',
      location: 'Room 4',
      description: 'Bring the forms',
      participants: [{ id: 'ada', status: 'accepted' }],
    })

    // then
    expect(linesOf(full, nothing)).toBe(2)
    expect(contentOf(full, nothing)).toEqual({
      tags: [],
      place: '',
      statuses: [],
      description: '',
    })
  })

  it('guesses the lines of the title and of the description from their length, 25 characters to a line, up to three', () => {
    // then
    expect(linesOf(event({ title: 'a'.repeat(25) }), nothing)).toBe(2)
    expect(linesOf(event({ title: 'a'.repeat(26) }), nothing)).toBe(3)
    expect(linesOf(event({ title: 'a'.repeat(76) }), nothing)).toBe(4) // three lines at most
    expect(linesOf(event({ title: '' }), nothing)).toBe(2) // the line of the title is always there
    const description = event({ description: 'b'.repeat(40) })
    expect(linesOf(description, { ...nothing, description: true })).toBe(4) // two lines of it
  })

  it('reads the description as one paragraph, and the answers of the participants as a list', () => {
    // given
    const some = event({
      description: 'Bring the\n  forms',
      participants: [
        { id: 'ada', status: 'accepted' },
        { id: 'bob', status: 'declined' },
      ],
    })

    // then
    expect(contentOf(some, defaultViewOptions)).toMatchObject({
      description: 'Bring the forms',
      statuses: ['accepted', 'declined'],
    })
  })
})
