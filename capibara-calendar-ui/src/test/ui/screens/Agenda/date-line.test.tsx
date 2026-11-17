import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { date, renderScreen, setUpAgenda } from '@/test/support/agenda'

let removeSizes: () => void

beforeEach(() => {
  removeSizes = setUpAgenda()
})

afterEach(() => {
  removeSizes()
  vi.useRealTimers()
})

it('picks a month and a year from lists, keeping the day', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  await userEvent.click(screen.getByRole('combobox', { name: /^Month/ }))
  await userEvent.click(await screen.findByRole('option', { name: 'December' }))

  // then
  expect(date()).toHaveValue('2026-12-12')

  // when
  await userEvent.click(screen.getByRole('combobox', { name: /^Year/ }))
  await userEvent.click(await screen.findByRole('option', { name: '2030' }))

  // then
  expect(date()).toHaveValue('2030-12-12')
})

it('keeps the day within the month when the month changes', async () => {
  // given
  vi.setSystemTime(new Date('2026-01-31T10:00:00'))
  renderScreen()
  await screen.findByRole('status')

  // when
  await userEvent.click(screen.getByRole('combobox', { name: /^Month/ }))
  await userEvent.click(await screen.findByRole('option', { name: 'February' }))

  // then
  expect(date()).toHaveValue('2026-02-28')
})

it('offers ten years back and ten forward, around the selected year', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  const years = async () =>
    (await screen.findAllByRole('option')).map((option) => option.textContent)

  // when
  await userEvent.click(screen.getByRole('combobox', { name: /^Year/ }))
  const first = await years()

  // then
  expect(first).toHaveLength(21)
  expect(first[0]).toBe('2016')
  expect(first[10]).toBe('2026') // the selected year, in the middle
  expect(first[20]).toBe('2036')

  // when
  await userEvent.click(screen.getByRole('option', { name: '2036' }))
  await userEvent.click(screen.getByRole('combobox', { name: /^Year/ }))
  const next = await years()

  // then
  expect(next[10]).toBe('2036')
})

it('picks any date with the date picker, and opens it when tapped', async () => {
  // given
  const showPicker = vi.fn()
  Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
    configurable: true,
    value: showPicker,
  })
  try {
    renderScreen()
    await screen.findByRole('button', { name: /Standup/ })

    // when
    await userEvent.click(date())

    // then
    expect(showPicker).toHaveBeenCalledOnce()

    // when
    fireEvent.change(date(), { target: { value: '2026-12-25' } })

    // then
    expect(date()).toHaveValue('2026-12-25')
    expect(screen.getByRole('combobox', { name: /^Month/ })).toHaveTextContent('December')
  } finally {
    Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker')
  }
})

it('decides what today is in the time zone that was chosen', async () => {
  // given: noon in London is the next day on Kiritimati
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z'))
  localStorage.setItem(
    'capibara-calendar',
    JSON.stringify({ settings: { timeZone: 'Pacific/Kiritimati' } }),
  )

  // when
  renderScreen()
  await screen.findByRole('status')

  // then
  expect(date()).toHaveValue('2026-11-13')
})
