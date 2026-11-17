import { primaryConnectionId, saveConnectionOf } from '../lib/connection'
import type { CalendarEvent } from './legacy'
import { getApi } from '../api'
import { checkCaldav } from '../api/sources'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { activateLocale } from '../i18n'
import englishCatalog from '../locales/en/messages.po?raw'
import italianCatalog from '../locales/it/messages.po?raw'
import type { RouteState } from '../lib/route-state'
import { renderApp } from './render'
import { contractOf, serveEvents } from './server'
import { seedStored } from './support/stored'

vi.mock('../api/sources', async (original) => ({
  ...(await original<typeof import('../api/sources')>()),
  checkCaldav: vi.fn(),
}))

type Entry = [id: string, translation: string]

function readCatalog(locale: 'en' | 'it'): Entry[] {
  const file = locale === 'en' ? englishCatalog : italianCatalog
  return [...file.matchAll(/msgid "((?:[^"\\]|\\.)*)"\nmsgstr "((?:[^"\\]|\\.)*)"/g)]
    .map(([, id, translation]): Entry => [id, translation])
    .filter(([id]) => id)
}

// Words that are the same in both languages, or that need no translation.
describe('the Italian catalog', () => {
  const italian = readCatalog('it')

  it('has a translation for every message', () => {
    expect(italian.length).toBeGreaterThan(40)
    expect(italian.filter(([, translation]) => !translation).map(([id]) => id)).toEqual([])
  })

  it('does not leave a message as it is in English, except for the ones that are the same', () => {
    const same = italian.filter(([id, translation]) => id === translation).map(([id]) => id)
    // Names of units, and words that are the same in Italian.
    expect(same.sort()).toEqual(
      [
        'Agenda',
        'CalDAV',
        'Chat',
        'Lime',
        'Magenta',
        'Password',
        'Reset',
        'Webcal',
        '{hours} h',
        '{hours} h {minutes} min',
        '{minutes} min',
      ].sort(),
    )
  })

  it('has the same messages as the English one', () => {
    expect(italian.map(([id]) => id)).toEqual(readCatalog('en').map(([id]) => id))
  })
})

const event = (title: string, fields: Partial<CalendarEvent> = {}): CalendarEvent => ({
  calendarUrl: '/personal/',
  uid: title,
  url: `/personal/${title}.ics`,
  ics: '',
  title,
  description: 'Descrizione',
  startDate: '2026-11-12',
  startTime: '09:00',
  endDate: '2026-11-12',
  endTime: '10:00',
  ...fields,
})

const recurring = event('Riunione', {
  isRecurring: true,
  ics: 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:r\r\nDTSTART:20261112T080000Z\r\nRRULE:FREQ=WEEKLY\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
})

const route = (state: RouteState) => {
  const savedOn = Temporal.Now.plainDateISO().toString() // today: the day is still the one to show
  seedStored({ routeState: { ...state, savedOn } })
}

// Every text that a person can read or hear on the screen: the text, and the labels.
function words() {
  const found = new Set<string>()
  for (const element of document.body.querySelectorAll('*')) {
    for (const name of ['aria-label', 'placeholder', 'title']) {
      const value = element.getAttribute(name)
      if (value) found.add(value.trim())
    }
    for (const node of element.childNodes) {
      const value = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '').trim() : ''
      if (value) found.add(value)
    }
  }
  return found
}

const english = readCatalog('it')
  .filter(([id, translation]) => id !== translation && !id.includes('{'))
  .map(([id]) => id)

it('knows many English labels to look for', () => {
  expect(english.length).toBeGreaterThan(30)
})

describe('the app in Italian', () => {
  beforeEach(async () => {
    saveConnectionOf(primaryConnectionId, {
      url: 'https://caldav.example/dav/',
      username: 'user',
      password: 'secret',
    })
    vi.setSystemTime(new Date('2026-11-12T10:00:00'))
    await activateLocale('it')
    serveEvents(
      [event('Dentista'), recurring],
      [{ url: '/personal/', name: 'Personale', color: '#2563eb' }],
    )
  })

  const screens: [string, RouteState, string][] = [
    ['the agenda, with the week', { route: { screen: 'list' }, layout: 'agenda' }, 'Oggi'],
    ['the agenda, with the month', { route: { screen: 'list' }, layout: 'agenda' }, 'Mese'],
    ['the week as rows', { route: { screen: 'list' }, layout: 'weekRows' }, 'Oggi'],
    [
      'the layouts',
      { route: { screen: 'layouts', date: '2026-11-12' }, layout: 'agenda' },
      'Settimana',
    ],
    ['the filter', { route: { screen: 'calendars' }, layout: 'agenda' }, 'Mostra tutti'],
    ['the settings', { route: { screen: 'settings' }, layout: 'agenda' }, 'Fuso orario'],
    ['a new event', { route: { screen: 'event', date: '2026-11-12' }, layout: 'agenda' }, 'Inizio'],
    [
      'an event',
      { route: { screen: 'event', ref: contractOf(event('Dentista')).ref }, layout: 'agenda' },
      'Elimina',
    ],
    [
      'an event that repeats',
      { route: { screen: 'event', ref: contractOf(recurring).ref }, layout: 'agenda' },
      'Elimina',
    ],
  ]

  it.each(screens)('has no English label on %s', async (name, state, expected) => {
    if (name.endsWith('month')) seedStored({ pickerMode: 'month' })
    route(state)
    renderApp(<App />)
    await waitFor(() => {
      expect(
        [...words()].some((word) => word === expected) ||
          screen.queryByRole('button', { name: expected }) !== null,
      ).toBe(true)
    })
    await screen.findByRole('status', {}, { timeout: 2000 }).catch(() => undefined)

    expect(english.filter((word) => words().has(word))).toEqual([])
  })

  it('has no English label in the questions and the problems of the form', async () => {
    vi.mocked(getApi().listCalendars).mockRejectedValue(new TypeError('Failed to fetch'))
    route({ route: { screen: 'event', ref: contractOf(recurring).ref }, layout: 'agenda' })
    renderApp(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Elimina' }))
    await screen.findByRole('alertdialog')
    expect(english.filter((word) => words().has(word))).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Impossibile raggiungere il server CalDAV',
      )
    })
    expect(english.filter((word) => words().has(word))).toEqual([])
  })

  it('has no English label in the problems of the connection', async () => {
    vi.mocked(checkCaldav).mockRejectedValue(new TypeError('Failed to fetch'))
    route({ route: { screen: 'settings' }, layout: 'agenda' })
    renderApp(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Cambia' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Connetti' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Impossibile raggiungere il server CalDAV',
      )
    })
    expect(english.filter((word) => words().has(word))).toEqual([])
  })
})
