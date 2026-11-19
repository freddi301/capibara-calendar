import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { activateLocale } from '@/i18n'
import { keyOf, serveEvents } from '@/test/server'
import { seedStored } from '@/test/support/stored'
import {
  cardsOf,
  conferenceText,
  event,
  events,
  renderScreen,
  row,
  setUpWeekRows,
  standupText,
} from '@/test/support/week-rows'

setUpWeekRows()

it('shows the seven days of the week as rows', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  const rows = within(row(/Monday, November 9/).parentElement as HTMLElement).getAllByRole('group')
  expect(rows.map((item) => item.getAttribute('aria-label'))).toEqual([
    'Monday, November 9, 2026',
    'Tuesday, November 10, 2026',
    'Wednesday, November 11, 2026',
    'Thursday, November 12, 2026',
    'Friday, November 13, 2026',
    'Saturday, November 14, 2026',
    'Sunday, November 15, 2026',
  ])
  expect(row(/Thursday/)).toHaveTextContent('Thu 12')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
})

it('shows the events of each day as cards, with the time and how long it lasts above the title', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(cardsOf(/Thursday/).map((card) => card.textContent)).toEqual([
    conferenceText,
    standupText,
    '16:00 Release',
    '18:00–19:00 1 hGym',
  ])
  expect(cardsOf(/Friday/)).toHaveLength(1) // Conference goes on
})

it('leaves the days with nothing planned empty, without a word about it', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(cardsOf(/Monday/)).toHaveLength(0)
  expect(row(/Monday/)).toHaveTextContent(/^Mon 9$/) // only the day, no text about the lack of events
})

it('has two cards across, the others scrolled to sideways, without saying so', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  const thursday = cardsOf(/Thursday/)
  expect(thursday).toHaveLength(4)
  expect(thursday[0].parentElement?.parentElement).toHaveClass(
    'overflow-x-auto',
    '[&::-webkit-scrollbar]:hidden',
  )
  for (const card of thursday)
    expect(card.className).toContain(
      'basis-[calc((100%-(var(--cards,2)-1)*0.375rem)/var(--cards,2))]',
    )
  expect(screen.queryByText(/more/i)).not.toBeInTheDocument()
})

it('gives every card the height of its row, whatever the number of cards', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then: the cards are stretched by the row, and not one of them has a height of its own
  const cards = screen.getAllByRole('button', { name: /Conference|Standup|Release|Gym/ })
  expect(cards.length).toBeGreaterThan(3)
  for (const card of cards) {
    expect(card).toHaveClass('h-auto')
    expect(card.parentElement?.parentElement).toHaveClass('items-stretch')
  }
})

it('edits an event from its card', async () => {
  // given
  const { onEdit } = renderScreen()

  // when
  await userEvent.click(await screen.findByRole('button', { name: /Standup/ }))

  // then
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ title: events[0].title }))
})

it('opens the event, and not a new one, when a card is pressed', async () => {
  // given
  const { onCreate, onEdit } = renderScreen()
  const standup = await screen.findByRole('button', { name: /Standup/ })

  // when
  await userEvent.click(standup)

  // then
  expect(onEdit).toHaveBeenCalledOnce()
  expect(onCreate).not.toHaveBeenCalled()
})

it('opens a new event for the day when the empty space of its row is pressed', async () => {
  // given
  const { onCreate } = renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when: Tuesday has nothing planned, so the whole of its row is empty space
  await userEvent.click(row(/Tuesday/).querySelector('[role="presentation"]') as HTMLElement)

  // then
  expect(onCreate).toHaveBeenLastCalledWith('2026-11-10')

  // when: Thursday has cards, and the space that is left beside them is the same
  await userEvent.click(row(/Thursday/).querySelector('[role="presentation"]') as HTMLElement)

  // then
  expect(onCreate).toHaveBeenLastCalledWith('2026-11-12')
  expect(onCreate).toHaveBeenCalledTimes(2)
})

it('is in the language of the app, with the times of the habit of it', async () => {
  // given
  await activateLocale('it')

  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(row(/giovedì 12 novembre 2026/)).toHaveTextContent('Gio 12')
  expect(cardsOf(/giovedì/)[1]).toHaveTextContent('09:00–09:30 30 minStandup')
})

it('does not show the events of the calendars that are hidden', async () => {
  // given
  serveEvents([
    event('Standup', { startTime: '09:00' }),
    event('Secret', { calendarUrl: '/hidden/' }),
  ])
  seedStored({ hiddenCalendars: [keyOf('/hidden/')] })

  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(screen.queryByRole('button', { name: /Secret/ })).not.toBeInTheDocument()
})

it('has the color of the calendar as the right border of the card', async () => {
  // given
  serveEvents([event('Standup', { startTime: '09:00', color: '#16a34a' }), event('Plain', {})])

  // when
  renderScreen()
  const standup = await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(standup.style.borderRightColor).toBe('rgb(22, 163, 74)')
  expect(standup).toHaveClass('border-r-4')
  const plain = screen.getByRole('button', { name: /Plain/ })
  expect(plain.style.borderRightColor).toBe('')
  expect(plain).not.toHaveClass('border-r-4')
})

it('lets the title break anywhere, even in a word, and shows up to three lines of it', async () => {
  // given
  serveEvents([event('Averyveryverylongwordwithoutspaces', { startDate: '2026-11-13' })])

  // when
  renderScreen()
  const card = await screen.findByRole('button', { name: /Averyvery/ })

  // then
  expect(within(card).getByText(/Averyvery/)).toHaveClass('break-all', 'line-clamp-3')
})
