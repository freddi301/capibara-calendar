import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { activateLocale } from '@/i18n'
import { renderApp } from '@/test/render'
import { openCreateScreen, setUpApp } from '@/test/support/app'
import { seedStored } from '@/test/support/stored'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkCaldav: vi.fn(),
}))
vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  resetApi: vi.fn(),
}))

beforeEach(setUpApp)

afterEach(() => {
  vi.useRealTimers()
})

it('shows the derived durations of the start and the end', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()

  // when: whole days, the first and the last day both count
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-12' } })

  // then
  expect(await screen.findByText('1 day')).toBeInTheDocument()

  // when
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-14' } })

  // then
  expect(await screen.findByText('3 days')).toBeInTheDocument()

  // when: with times, the days that passed and the time beyond them add up, nothing is counted twice
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-12' } })
  fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '09:30' } })
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '11:00' } })

  // then
  expect(await screen.findByText('1 h 30 min')).toBeInTheDocument()
  expect(screen.queryByText('1 day')).not.toBeInTheDocument()

  // when
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '10:30' } })

  // then
  expect(await screen.findByText('1 h')).toBeInTheDocument()

  // when
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '09:45' } })

  // then
  expect(await screen.findByText('15 min')).toBeInTheDocument()

  // when
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-14' } })
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '11:00' } })

  // then
  expect(await screen.findByText(/^2 days/)).toBeInTheDocument()
  expect(screen.getByText(/1 h 30 min$/)).toBeInTheDocument()

  // when: exactly whole days, the days say it all
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '09:30' } })

  // then
  expect(await screen.findByText('2 days')).toBeInTheDocument()
  expect(screen.queryByText(/ min$| h$/)).not.toBeInTheDocument()
})

it('shows the durations in the language of the app', async () => {
  // given
  await activateLocale('it')
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Nuovo evento' }))

  // when
  fireEvent.change(screen.getByLabelText('Data di inizio'), { target: { value: '2026-11-12' } })
  fireEvent.change(screen.getByLabelText('Data di fine'), { target: { value: '2026-11-14' } })

  // then
  expect(await screen.findByText('3 giorni')).toBeInTheDocument()
  expect(screen.getByText('Inizio')).toBeInTheDocument()
  expect(screen.getByText('Fine')).toBeInTheDocument()
})

it('opens the native picker when a date or time field is clicked', async () => {
  // given: jsdom has no pickers, so showPicker is added for this test
  const showPicker = vi.fn()
  Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
    configurable: true,
    value: showPicker,
  })
  try {
    renderApp(<App />)
    await openCreateScreen()

    // when
    for (const label of ['Start date', 'Start time', 'End date', 'End time']) {
      await userEvent.click(screen.getByLabelText(label))
    }

    // then
    expect(showPicker).toHaveBeenCalledTimes(4)
  } finally {
    Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker')
  }
})

it('does not ask for the picker again when the field is touched: the browser opens it', async () => {
  // given
  const showPicker = vi.fn()
  Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
    configurable: true,
    value: showPicker,
  })
  try {
    renderApp(<App />)
    await openCreateScreen()
    const field = screen.getByLabelText('Start date')

    // when
    fireEvent(field, new PointerEvent('click', { bubbles: true, pointerType: 'touch' }))
    fireEvent(field, new PointerEvent('click', { bubbles: true, pointerType: 'pen' }))

    // then
    expect(showPicker).not.toHaveBeenCalled()

    // when
    fireEvent(field, new PointerEvent('click', { bubbles: true, pointerType: 'mouse' }))

    // then
    expect(showPicker).toHaveBeenCalledOnce()
  } finally {
    Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker')
  }
})

it('shows the dates and times of the form in the language of the app', async () => {
  // given
  const startsAt = async () => {
    await userEvent.click(await screen.findByRole('button', { name: /^(New event|Nuovo evento)$/ }))
    fireEvent.change(screen.getByLabelText(/^(Start time|Ora di inizio)$/), {
      target: { value: '09:30' },
    })
    fireEvent.change(screen.getByLabelText(/^(End date|Data di fine)$/), {
      target: { value: '2026-11-14' },
    })
  }
  const english = renderApp(<App />)

  // when
  await startsAt()

  // then: month first in English, and the time in 24 hours
  expect(screen.getByDisplayValue('11/12/2026')).toBeInTheDocument()
  expect(screen.getByDisplayValue('11/14/2026')).toBeInTheDocument()
  expect(screen.getAllByDisplayValue('09:30')).toHaveLength(2) // the field, and what is shown of it

  // given
  english.unmount()
  seedStored({ routeState: undefined }) // the screen is remembered: start from the list
  await activateLocale('it')
  renderApp(<App />)

  // when
  await startsAt()

  // then: day first in Italian, and 24 hours
  expect(screen.getByDisplayValue('12/11/2026')).toBeInTheDocument()
  expect(screen.getByDisplayValue('14/11/2026')).toBeInTheDocument()
  // The native field also holds 09:30 (its value is always 24 hours); the one on show is read-only.
  const shown = screen
    .getAllByDisplayValue('09:30')
    .filter((input) => input.hasAttribute('readonly'))
  expect(shown).toHaveLength(1)
})
