import { screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderScreen, setUpMonth } from '@/test/support/month'

setUpMonth()

async function cellOf(name: string) {
  await screen.findByRole('button', { name: /Solo/ }) // the events came
  const create = await screen.findByRole('button', { name: `New event: ${name}` })
  const cell = create.closest<HTMLElement>('[role="gridcell"]')
  if (!cell) throw new Error('the day has no cell')
  return cell
}

const dotOf = (cell: HTMLElement, title: string) =>
  within(cell).queryByRole('button', { name: title })

it('has the events of a day in the order of the agenda: the whole day ones, then by time', async () => {
  // given
  renderScreen()

  // when
  const cell = await cellOf('Thursday, November 12, 2026')

  // then
  const cards = [...cell.querySelectorAll('[data-slot="calendar-color"]')].map(
    (card) => card.textContent,
  )
  expect(cards).toEqual([
    expect.stringContaining('Conference'),
    expect.stringContaining('Standup'),
    expect.stringContaining('Release'),
  ])
})

it('has a dot for each of the events of a day, up to six, and the first one is the current', async () => {
  // given
  renderScreen()

  // when
  const cell = await cellOf('Friday, November 20, 2026')

  // then
  const titles = Array.from({ length: 6 }, (_, index) => `Review ${index + 1}`)
  for (const title of titles) expect(dotOf(cell, title)).toBeInTheDocument()
  expect(dotOf(cell, 'Review 1')).toHaveAttribute('aria-current', 'true')
  expect(dotOf(cell, 'Review 2')).not.toHaveAttribute('aria-current')
  expect(dotOf(cell, 'Review 6')?.querySelector('svg')).not.toBeInTheDocument() // not an arrow
})

it('has five dots and an arrow for the sixth event, when a day has more than six', async () => {
  // given
  renderScreen()

  // when
  const cell = await cellOf('Tuesday, November 17, 2026')

  // then
  for (const title of ['Meeting 1', 'Meeting 2', 'Meeting 3', 'Meeting 4', 'Meeting 5']) {
    expect(dotOf(cell, title)).toBeInTheDocument()
    expect(dotOf(cell, title)?.querySelector('svg')).not.toBeInTheDocument()
  }
  expect(dotOf(cell, 'Meeting 6')?.querySelector('svg')).toBeInTheDocument()
  expect(dotOf(cell, 'Meeting 7')).not.toBeInTheDocument()
  expect(dotOf(cell, 'Meeting 8')).not.toBeInTheDocument()
  // the events that have no dot are still there to scroll to
  expect(within(cell).getByRole('button', { name: /Meeting 8/ })).toBeInTheDocument()
})

it('has no indicator for a day with one event, nor for a day with none', async () => {
  // given
  renderScreen()

  // when
  const one = await cellOf('Tuesday, November 24, 2026')
  const none = await cellOf('Friday, November 27, 2026')

  // then
  expect(within(one).getAllByRole('button')).toHaveLength(2) // the one to create, and the card
  expect(within(none).getAllByRole('button')).toHaveLength(1) // the one to create
})
