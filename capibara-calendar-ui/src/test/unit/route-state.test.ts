// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from '@/test/legacy'
import { calendarInfoOf, contractOf } from '@/test/server'
import { seedStored, seedText, storedJson } from '@/test/support/stored'
import { loadRouteState, saveRouteState, type RouteState } from '@/lib/route-state'

const initial: RouteState = { route: { screen: 'list' }, layout: 'agenda' }

const legacy: CalendarEvent = {
  calendarUrl: '/personal/',
  title: 'Dentist',
  description: '',
  startDate: '2026-11-12',
  startTime: '09:30',
  endDate: '',
  endTime: '',
  uid: '1',
  url: '/personal/1.ics',
  etag: '"abc"',
  ics: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
  isRecurring: true,
}

const { ref } = contractOf(legacy)

describe('route state', () => {
  it('is the list, in the week layout, when nothing was stored', () => {
    expect(loadRouteState()).toEqual(initial)
  })

  it('brings back every screen, with what it needs, and the layout', () => {
    const states: RouteState[] = [
      { route: { screen: 'list', date: '2026-11-14' }, layout: 'agenda' },
      { route: { screen: 'event', date: '2026-11-14' }, layout: 'weekRows' },
      { route: { screen: 'event', ref }, layout: 'weekRows' },
      { route: { screen: 'layouts', date: '2026-11-14' }, layout: 'agenda' },
      { route: { screen: 'calendars' }, layout: 'agenda' },
      { route: { screen: 'settings' }, layout: 'weekRows' },
    ]
    for (const state of states) {
      saveRouteState(state)
      expect(loadRouteState()).toEqual(state)
    }
  })

  it('goes to the list when the screen is not one that exists, or lacks what it needs', () => {
    for (const route of [
      { screen: 'nowhere' },
      { screen: 'layouts' }, // no date
      { screen: 'list', date: 'yesterday' },
      { screen: 'detail', event: 'Dentist' }, // not a reference to an event
      'list',
    ]) {
      seedStored({ routeState: { route, layout: 'agenda' } })
      expect(loadRouteState()).toEqual({ route: { screen: 'list' }, layout: 'agenda' })
    }
  })

  it('has the week layout when the layout is not one that exists, and keeps the screen', () => {
    seedStored({ routeState: { route: { screen: 'settings' }, layout: 'spiral' } })
    expect(loadRouteState()).toEqual({ route: { screen: 'settings' }, layout: 'agenda' })
  })

  it('keeps the month table layout, as it is not one of the old names of a layout', () => {
    // given
    const state: RouteState = {
      route: { screen: 'list', date: '2026-11-14' },
      layout: 'monthTable',
    }
    saveRouteState(state)

    // when
    const loaded = loadRouteState()

    // then
    expect(loaded).toEqual(state)
  })

  it('has the agenda for the names that layouts had before: days, week and month', () => {
    for (const layout of ['days', 'week', 'month']) {
      // given
      seedStored({ routeState: { route: { screen: 'settings' }, layout } })

      // when
      const loaded = loadRouteState()

      // then
      expect(loaded).toEqual({ route: { screen: 'settings' }, layout: 'agenda' })
    }
  })

  it('is the start when what was stored is not usable at all', () => {
    for (const stored of ['not json', 'null', '[]', '42']) {
      seedText(stored)
      expect(loadRouteState()).toEqual(initial)
    }
  })

  it('does not fail when the storage cannot be used', () => {
    const blocked = () => {
      throw new Error('blocked')
    }
    const spies = [
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked),
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked),
    ]
    try {
      expect(() => {
        saveRouteState(initial)
      }).not.toThrow()
      expect(loadRouteState()).toEqual(initial)
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })
})

describe('route state on another day', () => {
  const stored = (state: RouteState, savedOn: string | undefined) => {
    seedStored({ routeState: { ...state, savedOn } })
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('remembers the day that was shown, for the rest of the day that it was saved on', () => {
    vi.setSystemTime(new Date('2026-11-12T08:00:00'))
    saveRouteState({ route: { screen: 'list', date: '2026-11-20' }, layout: 'weekRows' })

    vi.setSystemTime(new Date('2026-11-12T23:30:00'))
    expect(loadRouteState()).toEqual({
      route: { screen: 'list', date: '2026-11-20' },
      layout: 'weekRows',
    })
  })

  it('starts on today, on the next day, in the layout that was chosen', () => {
    vi.setSystemTime(new Date('2026-11-12T20:00:00'))
    saveRouteState({ route: { screen: 'list', date: '2026-11-20' }, layout: 'agenda' })

    vi.setSystemTime(new Date('2026-11-13T08:00:00'))
    expect(loadRouteState()).toEqual({ route: { screen: 'list' }, layout: 'agenda' })
  })

  it('does not keep a day for the screens that go with one, when it is another day', () => {
    vi.setSystemTime(new Date('2026-11-13T08:00:00'))
    stored({ route: { screen: 'layouts', date: '2026-11-20' }, layout: 'agenda' }, '2026-11-12')
    expect(loadRouteState().route).toEqual({ screen: 'list' })

    stored({ route: { screen: 'event', date: '2026-11-20' }, layout: 'agenda' }, '2026-11-12')
    expect(loadRouteState().route).toEqual({ screen: 'event' }) // a new event, on today
  })

  it('keeps what is not about a day, whatever the day is', () => {
    vi.setSystemTime(new Date('2026-11-13T08:00:00'))
    for (const route of [
      { screen: 'settings' },
      { screen: 'calendars' },
      { screen: 'event', ref },
    ] as const) {
      stored({ route, layout: 'agenda' }, '2026-11-12')
      expect(loadRouteState().route).toEqual(route)
    }
  })

  it('treats what was saved without a day as old', () => {
    vi.setSystemTime(new Date('2026-11-13T08:00:00'))
    stored({ route: { screen: 'list', date: '2026-11-20' }, layout: 'agenda' }, undefined)

    expect(loadRouteState().route).toEqual({ screen: 'list' })
  })

  it('takes the day in the time zone that was chosen', () => {
    seedStored({ settings: { timeZone: 'Pacific/Kiritimati' } })
    vi.setSystemTime(new Date('2026-11-12T12:00:00Z')) // the 13th there
    saveRouteState({ route: { screen: 'list', date: '2026-11-20' }, layout: 'agenda' })

    const saved = storedJson().routeState as { savedOn?: string }
    expect(saved.savedOn).toBe('2026-11-13')
    expect(loadRouteState().route).toEqual({ screen: 'list', date: '2026-11-20' })
  })
})

describe('route state of the calendar', () => {
  it('brings back the calendar that was being edited, or a new one', () => {
    for (const state of [
      {
        route: {
          screen: 'calendar',
          calendar: calendarInfoOf({ url: '/work/', name: 'Work', color: '#dc2626' }),
        },
        layout: 'agenda',
      },
      { route: { screen: 'calendar' }, layout: 'weekRows' },
    ] as const) {
      saveRouteState(state)
      expect(loadRouteState()).toEqual(state)
    }
  })

  it('goes to the list when what was remembered of the calendar is not whole', () => {
    seedStored({
      routeState: { route: { screen: 'calendar', calendar: { name: 'Work' } }, layout: 'agenda' },
    })
    expect(loadRouteState().route).toEqual({ screen: 'list' })
  })

  it('keeps the calendar, whatever the day is', () => {
    vi.setSystemTime(new Date('2026-11-13T08:00:00'))
    const route = { screen: 'calendar' } as const
    seedStored({ routeState: { route, layout: 'agenda', savedOn: '2026-11-12' } })
    expect(loadRouteState().route).toEqual(route)
    vi.useRealTimers()
  })

  it('opens the event of a link of the chat, before the screen that was left, and only in a chat', () => {
    seedStored({ routeState: { route: { screen: 'settings' }, layout: 'agenda' } })
    window.location.hash = `#event=${encodeURIComponent('chat/team/e1#2026-11-12T09:00:00')}`
    const linked = {
      screen: 'detail',
      ref: {
        sourceId: 'chat',
        calendarId: 'team',
        eventId: 'e1',
        recurrenceId: '2026-11-12T09:00:00',
      },
    }

    expect(loadRouteState().route).toEqual({ screen: 'settings' }) // not in a chat: it is not a link

    Object.assign(window, { webxdc: { selfAddr: 'me', selfName: 'Me' } })
    expect(loadRouteState().route).toEqual(linked)

    window.location.hash = '#event=nonsense'
    expect(loadRouteState().route).toEqual({ screen: 'settings' }) // not a key of an event

    Reflect.deleteProperty(window, 'webxdc')
    window.location.hash = ''
  })
})

describe('the layouts that were stored', () => {
  const layoutOf = (layout: string) => {
    seedStored({ routeState: { route: { screen: 'settings' }, layout } })
    return loadRouteState().layout
  }

  it('are the same, when they are of the ones that there are', () => {
    expect(layoutOf('agenda')).toBe('agenda')
    expect(layoutOf('weekRows')).toBe('weekRows')
  })

  it('are the Agenda, for the Days that is gone, the week and the month, and for the others', () => {
    expect(layoutOf('days')).toBe('agenda')
    expect(layoutOf('week')).toBe('agenda')
    expect(layoutOf('month')).toBe('agenda')
    expect(layoutOf('spiral')).toBe('agenda')
  })
})
