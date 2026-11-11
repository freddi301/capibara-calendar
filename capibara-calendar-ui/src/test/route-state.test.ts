import { vi } from 'vitest'
import { describe, expect, it } from 'vitest'
import { loadRouteState, saveRouteState, type RouteState } from '../lib/route-state'

const storageKey = 'capibara-calendar-route'
const initial: RouteState = { route: { screen: 'list' }, layout: 'week' }

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
      { route: { screen: 'event', date: '2026-11-14' }, layout: 'month' },
      { route: { screen: 'event', event }, layout: 'weekRows' },
      { route: { screen: 'layouts', date: '2026-11-14' }, layout: 'week' },
      { route: { screen: 'filter' }, layout: 'week' },
      { route: { screen: 'settings' }, layout: 'month' },
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
    expect(loadRouteState()).toEqual({ route: { screen: 'settings' }, layout: 'week' })
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
