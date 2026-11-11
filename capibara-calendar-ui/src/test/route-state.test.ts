import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRouteState, saveRouteState, type RouteState } from '../lib/route-state'

const storageKey = 'capibara-calendar-route'
const initial: RouteState = { route: { screen: 'list' }, layout: 'days' }

const event = {
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

describe('route state', () => {
  it('is the list, in the week layout, when nothing was stored', () => {
    expect(loadRouteState()).toEqual(initial)
  })

  it('brings back every screen, with what it needs, and the layout', () => {
    const states: RouteState[] = [
      { route: { screen: 'list', date: '2026-11-14' }, layout: 'agenda' },
      { route: { screen: 'event', date: '2026-11-14' }, layout: 'weekRows' },
      { route: { screen: 'event', event }, layout: 'weekRows' },
      { route: { screen: 'layouts', date: '2026-11-14' }, layout: 'days' },
      { route: { screen: 'filter' }, layout: 'days' },
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
      { screen: 'event', event: { title: 'Dentist' } }, // not a whole event
      'list',
    ]) {
      localStorage.setItem(storageKey, JSON.stringify({ route, layout: 'agenda' }))
      expect(loadRouteState()).toEqual({ route: { screen: 'list' }, layout: 'agenda' })
    }
  })

  it('has the week layout when the layout is not one that exists, and keeps the screen', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ route: { screen: 'settings' }, layout: 'spiral' }),
    )
    expect(loadRouteState()).toEqual({ route: { screen: 'settings' }, layout: 'days' })
  })

  it('is the start when what was stored is not usable at all', () => {
    for (const stored of ['not json', 'null', '[]', '42']) {
      localStorage.setItem(storageKey, stored)
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
    localStorage.setItem(storageKey, JSON.stringify({ ...state, savedOn }))
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
    stored({ route: { screen: 'layouts', date: '2026-11-20' }, layout: 'days' }, '2026-11-12')
    expect(loadRouteState().route).toEqual({ screen: 'list' })

    stored({ route: { screen: 'event', date: '2026-11-20' }, layout: 'days' }, '2026-11-12')
    expect(loadRouteState().route).toEqual({ screen: 'event' }) // a new event, on today
  })

  it('keeps what is not about a day, whatever the day is', () => {
    vi.setSystemTime(new Date('2026-11-13T08:00:00'))
    for (const route of [
      { screen: 'settings' },
      { screen: 'filter' },
      { screen: 'event', event },
    ] as const) {
      stored({ route, layout: 'days' }, '2026-11-12')
      expect(loadRouteState().route).toEqual(route)
    }
  })

  it('treats what was saved without a day as old', () => {
    vi.setSystemTime(new Date('2026-11-13T08:00:00'))
    stored({ route: { screen: 'list', date: '2026-11-20' }, layout: 'days' }, undefined)

    expect(loadRouteState().route).toEqual({ screen: 'list' })
  })

  it('takes the day in the time zone that was chosen', () => {
    localStorage.setItem(
      'capibara-calendar-settings',
      JSON.stringify({ timeZone: 'Pacific/Kiritimati' }),
    )
    vi.setSystemTime(new Date('2026-11-12T12:00:00Z')) // the 13th there
    saveRouteState({ route: { screen: 'list', date: '2026-11-20' }, layout: 'days' })

    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as { savedOn?: string }
    expect(saved.savedOn).toBe('2026-11-13')
    expect(loadRouteState().route).toEqual({ screen: 'list', date: '2026-11-20' })
  })
})

describe('route state of the calendar', () => {
  it('brings back the calendar that was being edited, or a new one', () => {
    for (const state of [
      {
        route: { screen: 'calendar', calendar: { url: '/work/', name: 'Work', color: '#dc2626' } },
        layout: 'days',
      },
      { route: { screen: 'calendar' }, layout: 'weekRows' },
    ] as const) {
      saveRouteState(state)
      expect(loadRouteState()).toEqual(state)
    }
  })

  it('goes to the list when what was remembered of the calendar is not whole', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ route: { screen: 'calendar', calendar: { name: 'Work' } }, layout: 'days' }),
    )
    expect(loadRouteState().route).toEqual({ screen: 'list' })
  })

  it('keeps the calendar, whatever the day is', () => {
    vi.setSystemTime(new Date('2026-11-13T08:00:00'))
    const route = { screen: 'calendar' } as const
    localStorage.setItem(
      storageKey,
      JSON.stringify({ route, layout: 'days', savedOn: '2026-11-12' }),
    )
    expect(loadRouteState().route).toEqual(route)
    vi.useRealTimers()
  })
})

describe('the layouts that were stored', () => {
  const layoutOf = (layout: string) => {
    localStorage.setItem(storageKey, JSON.stringify({ route: { screen: 'settings' }, layout }))
    return loadRouteState().layout
  }

  it('are the same, when they are of the ones that there are', () => {
    expect(layoutOf('agenda')).toBe('agenda')
    expect(layoutOf('weekRows')).toBe('weekRows')
    expect(layoutOf('days')).toBe('days')
  })

  it('are the Days, for the week and the month that were two layouts, and for the others', () => {
    expect(layoutOf('week')).toBe('days')
    expect(layoutOf('month')).toBe('days')
    expect(layoutOf('spiral')).toBe('days')
  })
})
