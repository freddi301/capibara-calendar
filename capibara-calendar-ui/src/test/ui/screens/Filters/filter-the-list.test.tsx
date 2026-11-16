import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { setUpApp } from '@/test/support/app'

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

async function openFilterAndGoBack(change: () => Promise<void>) {
  await userEvent.click(screen.getByRole('button', { name: 'Filter' }))
  await change()
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  await screen.findByRole('group', { name: 'Week' })
}

it('shows only the events that the rules choose, as they are made, and counts the rules', async () => {
  // given
  renderApp(<App />)
  expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()

  // when
  await openFilterAndGoBack(async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Add rule' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Title/ }))
    await userEvent.type(await screen.findByRole('textbox', { name: 'Title' }), 'zzz')
  })

  // then: nothing has "zzz" in its title, the list says so, and the icon says that a rule is there
  expect(await screen.findByText('No event matches the filter')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Dentist/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Filter' })).toHaveTextContent('1')

  // when
  await openFilterAndGoBack(async () => {
    const word = await screen.findByRole('textbox', { name: 'Title' })
    await userEvent.clear(word)
    await userEvent.type(word, 'dent')
  })

  // then
  expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()

  // when
  await openFilterAndGoBack(async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Reset' }))
  })

  // then
  expect(screen.getByRole('button', { name: 'Filter' })).not.toHaveTextContent('1')
})

it('goes to the filter from the export of a calendar, and comes back to the export, not to the list', async () => {
  // given
  renderApp(<App />)
  expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Calendars' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Export' }))
  const banner = await screen.findByRole('region', { name: 'Filter' })
  await userEvent.click(within(banner).getByRole('button', { name: 'Set a filter' }))
  // The filter, with the way back: the rules are made, and the export is where it was.
  await userEvent.click(await screen.findByRole('button', { name: 'Add rule' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: /Title/ }))
  await userEvent.type(await screen.findByRole('textbox', { name: 'Title' }), 'dent')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  // then
  const again = await screen.findByRole('region', { name: 'Filter' })
  expect(again).toHaveTextContent('Filter on: 1 rule')
  expect(screen.queryByRole('group', { name: 'Week' })).not.toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Calendar' })).toBeInTheDocument() // the export
})
