import type { CalendarEvent } from './legacy'
import { getApi } from '../api'
import { ApiError } from '../api/calendar-api'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import { addNode, emptyFilter, newRule } from '../lib/event-filter'
import { saveEventFilter } from '../lib/event-filter-store'
import ExportScreen from '../screens/ExportScreen'
import { renderApp } from './render'
import { serveEvents } from './server'

const weekly = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:Weekly sync',
  'SUMMARY:Weekly sync',
  'DTSTART:20261105T100000Z',
  'DTEND:20261105T103000Z',
  'RRULE:FREQ=WEEKLY',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n')

function event(title: string, fields: Partial<CalendarEvent>): CalendarEvent {
  return {
    calendarUrl: '/personal/',
    uid: title,
    url: `/personal/${title}.ics`,
    ics: '',
    title,
    description: '',
    startDate: '2026-11-12',
    startTime: '',
    endDate: '',
    endTime: '',
    ...fields,
  }
}

const calendars = [
  { url: '/personal/', name: 'Personal', color: '#2563eb' },
  { url: '/work/', name: 'Work', color: '#16a34a' },
  { url: '/empty/', name: 'Empty', color: '#dc2626' },
]

const events = [
  event('Dentist', { startTime: '09:30', endTime: '10:30' }),
  event('Weekly sync', {
    startTime: '11:00',
    endTime: '11:30',
    ics: weekly,
    isRecurring: true,
    occurrenceId: '20261112T100000Z',
  }),
  event('Review', { calendarUrl: '/work/', url: '/work/Review.ics' }),
]

// What the file that is saved says, and what it is called.
const saved: { name: string; text: string }[] = []

beforeEach(() => {
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  serveEvents(events, calendars)
  saved.length = 0
  URL.createObjectURL = vi.fn((blob: Blob) => {
    const reader = new FileReader()
    reader.onload = () => {
      saved.push({ name: '', text: typeof reader.result === 'string' ? reader.result : '' })
    }
    reader.readAsText(blob)
    return 'blob:export'
  })
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ name: this.download, text: '' })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const renderScreen = () => {
  const onClose = vi.fn()
  const onOpenFilters = vi.fn()
  renderApp(<ExportScreen onClose={onClose} onOpenFilters={onOpenFilters} />)
  return Object.assign(onClose, { onOpenFilters })
}

const chooseCalendar = async (name: string) => {
  await userEvent.click(await screen.findByRole('combobox', { name: 'Calendar' }))
  await userEvent.click(await screen.findByRole('option', { name }))
}

const recap = () =>
  screen.getByRole('region', { name: /What will be exported|Cosa verrà esportato/ })
const banner = () => screen.getByRole('region', { name: /^(Filter|Filtro)$/ })
const exportIt = () => userEvent.click(screen.getByRole('button', { name: 'Export' }))

const filterBy = (title: string) => {
  const root = emptyFilter()
  saveEventFilter(
    addNode(root, root.id, { ...newRule('title'), operator: 'contains', text: title }),
  )
}

describe('the form: the calendar and the filter', () => {
  it('has the calendar, the filter and the recap, all on one screen, with the button to export', async () => {
    renderScreen()

    expect(await screen.findByRole('combobox', { name: 'Calendar' })).toBeVisible()
    expect(banner()).toHaveTextContent('No filter: all events')
    expect(recap()).toBeVisible()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()
    })
  })

  it('says that the filter is on, and how many rules it has, and not what they say; and leads to the filter', async () => {
    filterBy('dentist')
    const onClose = renderScreen()

    expect(banner()).toHaveTextContent('Filter on: 1 rule')
    expect(banner()).not.toHaveTextContent('dentist')
    await userEvent.click(within(banner()).getByRole('button', { name: 'Change the filter' }))
    expect(onClose.onOpenFilters).toHaveBeenCalledOnce()
  })

  it('leads to the filter when there is none, too', async () => {
    const onClose = renderScreen()

    await userEvent.click(within(banner()).getByRole('button', { name: 'Set a filter' }))

    expect(onClose.onOpenFilters).toHaveBeenCalledOnce()
  })

  it('closes with the button of the screen', async () => {
    const onClose = renderScreen()

    await userEvent.click(await screen.findByRole('button', { name: /^(Back|Close)$/ }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('the recap: what will be exported', () => {
  it('says how many events, and how many occurrences that were changed, each on its own', async () => {
    renderScreen()

    await waitFor(() => {
      expect(recap()).toHaveTextContent('2 events')
    })
    expect(recap()).toHaveTextContent('0 customized occurrences')
    expect(recap()).toHaveTextContent('1 of the events repeats')
    expect(recap()).toHaveTextContent('File: Personal.ics')
  })

  it('is for the first calendar, and for the one that was chosen', async () => {
    renderScreen()
    await chooseCalendar('Work')

    await waitFor(() => {
      expect(recap()).toHaveTextContent('1 event')
    })
    expect(recap()).toHaveTextContent('File: Work.ics')
    expect(recap()).not.toHaveTextContent('repeat')
  })

  it('saves the calendar as a file with its name, and the events that the recap says, and only then', async () => {
    renderScreen()
    await waitFor(() => {
      expect(recap()).toHaveTextContent('2 events')
    })
    expect(saved).toEqual([])

    await exportIt()

    await waitFor(() => {
      expect(saved.some(({ text }) => text.includes('BEGIN:VCALENDAR'))).toBe(true)
    })
    expect(saved.find(({ name }) => name)?.name).toBe('Personal.ics')
    const text = saved.find((one) => one.text)?.text ?? ''
    expect(text).toContain('X-WR-CALNAME:Personal')
    expect(text).toContain('SUMMARY:Dentist')
    expect(text).toContain('SUMMARY:Weekly sync')
    expect(text).not.toContain('SUMMARY:Review') // that one is in the other calendar
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2)
  })

  it('has nothing to export for a calendar without events, and does not offer to', async () => {
    renderScreen()
    await chooseCalendar('Empty')

    await waitFor(() => {
      expect(recap()).toHaveTextContent('0 events')
    })
    expect(recap()).toHaveTextContent('There is nothing in this calendar to export.')
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
  })

  it('says that the calendar could not be read, and tries again', async () => {
    const reads = vi.spyOn(getApi(), 'exportEvents')
    reads.mockRejectedValueOnce(new ApiError('unreachable'))
    renderScreen()

    const problem = await screen.findByRole('alert')
    expect(problem).toHaveTextContent('Cannot reach the CalDAV server')
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()

    await userEvent.click(within(problem).getByRole('button', { name: 'Try again' }))

    await waitFor(() => {
      expect(recap()).toHaveTextContent('2 events')
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('counts and exports only what the filter lets through, and says how many it left out', async () => {
    filterBy('dentist')
    renderScreen()

    await waitFor(() => {
      expect(recap()).toHaveTextContent('1 event left out by the filter')
    })
    expect(banner()).toHaveTextContent('Filter on: 1 rule')
    expect(recap()).not.toHaveTextContent('repeat')
    await exportIt()
    await waitFor(() => {
      expect(saved.some(({ text }) => text.includes('BEGIN:VCALENDAR'))).toBe(true)
    })
    const text = saved.find((one) => one.text)?.text ?? ''
    expect(text).toContain('SUMMARY:Dentist')
    expect(text).not.toContain('Weekly sync')
  })

  it('is not offered when the filter lets nothing through, and says why', async () => {
    filterBy('no event has this in its title')
    renderScreen()

    await waitFor(() => {
      expect(recap()).toHaveTextContent('0 events')
    })
    expect(recap()).toHaveTextContent('2 events left out by the filter')
    expect(recap()).toHaveTextContent('No event of this calendar passes the filter.')
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
  })

  it('counts again when the filter changes', async () => {
    renderScreen()
    await waitFor(() => {
      expect(recap()).toHaveTextContent('2 events')
    })

    act(() => {
      filterBy('weekly')
    })

    await waitFor(() => {
      expect(recap()).toHaveTextContent('1 event left out by the filter')
    })
    expect(recap()).toHaveTextContent('1 of the events repeats')
  })

  it('says it in Italian, with the plural of the language', async () => {
    filterBy('dentist')
    await activateLocale('it')
    renderScreen()
    expect(banner()).toHaveTextContent('Filtro attivo: 1 regola')

    await waitFor(() => {
      expect(recap()).toHaveTextContent('1 evento escluso dal filtro')
    })
    expect(screen.getByRole('button', { name: 'Esporta' })).toBeEnabled()
  })
})

// ---- in a chat (webxdc): the file is sent to a chat, which the person chooses ----

describe('in a chat', () => {
  const sendToChat = vi.fn()

  beforeEach(() => {
    sendToChat.mockReset().mockResolvedValue(undefined)
    Object.assign(window, { webxdc: { sendToChat, selfAddr: 'ada@chat', selfName: 'Ada' } })
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'webxdc')
  })

  it('offers to send the calendar to a chat, and sends the file with its name and its events, and downloads nothing', async () => {
    renderScreen()
    await waitFor(() => {
      expect(recap()).toHaveTextContent('2 events')
    })

    await userEvent.click(screen.getByRole('button', { name: 'Send to a chat' }))

    await waitFor(() => {
      expect(sendToChat).toHaveBeenCalledOnce()
    })
    const { file } = sendToChat.mock.calls[0][0] as { file: { name: string; plainText: string } }
    expect(file.name).toBe('Personal.ics')
    expect(file.plainText).toContain('SUMMARY:Dentist')
    expect(file.plainText).toContain('SUMMARY:Weekly sync')
    expect(saved).toEqual([])
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()
  })

  it('says that the file could not be sent, when the chat says so', async () => {
    sendToChat.mockRejectedValueOnce(new Error('no chat'))
    renderScreen()
    await waitFor(() => {
      expect(recap()).toHaveTextContent('2 events')
    })

    await userEvent.click(screen.getByRole('button', { name: 'Send to a chat' }))

    await waitFor(() => {
      expect(document.querySelector('[data-sonner-toast]')).toHaveTextContent(
        'The file could not be sent to the chat.',
      )
    })
  })

  it('says it in Italian', async () => {
    await activateLocale('it')
    renderScreen()

    expect(await screen.findByRole('button', { name: 'Invia in una chat' })).toBeVisible()
  })
})
