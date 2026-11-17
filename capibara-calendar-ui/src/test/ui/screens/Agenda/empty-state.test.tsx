import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '@/i18n'
import { serveEvents } from '@/test/server'
import { renderScreen, setUpAgenda } from '@/test/support/agenda'

let removeSizes: () => void

beforeEach(() => {
  removeSizes = setUpAgenda()
})

afterEach(() => {
  removeSizes()
  vi.useRealTimers()
})

it('has no days when there is nothing planned, and does not say so', async () => {
  // given
  serveEvents([])

  // when
  renderScreen()
  await screen.findByRole('status')

  // then
  expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  expect(screen.queryByText('Nothing planned')).not.toBeInTheDocument()
})

it('says that nothing is planned, in the middle, when there is no event to list', async () => {
  // given
  serveEvents([])

  // when
  renderScreen()

  // then
  expect(await screen.findByText('Nothing planned')).toBeInTheDocument()
  expect(screen.getByText('The events that come will be here.')).toBeInTheDocument()
  expect(document.querySelector('[data-slot="empty-state"]')).toHaveClass('my-auto', 'text-center')
})

it('does not say that nothing is planned when there are events', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(screen.queryByText('Nothing planned')).not.toBeInTheDocument()
})

it('says it in Italian', async () => {
  // given
  await activateLocale('it')
  serveEvents([])

  // when
  renderScreen()

  // then
  expect(await screen.findByText('Niente in programma')).toBeInTheDocument()
  expect(screen.getByText('Gli eventi in arrivo compariranno qui.')).toBeInTheDocument()
})
