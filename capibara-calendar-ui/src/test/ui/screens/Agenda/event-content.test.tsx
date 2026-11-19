import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import EventCard from '@/components/EventCard'
import EventItem from '@/components/EventItem'
import TimelineBlock from '@/components/TimelineBlock'
import { defaultViewOptions } from '@/lib/use-stored'
import { layoutBlocks } from '@/lib/timeline'
import type { CalendarEvent } from '@/test/legacy'
import { renderApp } from '@/test/render'
import { displayOf, serveEvents } from '@/test/server'
import { seedStored } from '@/test/support/stored'

const source: CalendarEvent = {
  calendarUrl: '/c/',
  uid: '1',
  url: '/c/1.ics',
  ics: '',
  title: 'Standup',
  description: 'Bring the forms\nand the results',
  startDate: '2026-11-12',
  startTime: '09:00',
  endDate: '',
  endTime: '09:30',
  location: 'Room 4',
  tags: 'Work, team',
  participants: [
    { id: 'ada', status: 'accepted' },
    { id: 'bob', status: 'accepted' },
    { id: 'eve', status: 'declined' },
  ],
}

const showAll = { ...defaultViewOptions, calendar: true }

beforeEach(() => {
  serveEvents([source], [{ url: '/c/', name: 'Planning calendar', color: '' }])
})

afterEach(() => {
  localStorage.clear()
})

function renderItem(fields: Partial<CalendarEvent> = {}) {
  const event = displayOf({ ...source, ...fields })
  renderApp(
    <EventItem entry={{ event, start: event.startTime, end: event.endTime }} onEdit={vi.fn()} />,
  )
  return screen.getByRole('button')
}

const bar = (item: HTMLElement) => within(item).queryByRole('group')

/** Each element comes after the one before it in the page. */
function expectInOrder(elements: HTMLElement[]) {
  for (const element of elements) expect(element).toBeInTheDocument()
  for (const [index, element] of elements.slice(1).entries()) {
    const position = elements[index].compareDocumentPosition(element)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
}

it('says the time and how long it lasts above the title', () => {
  // when
  const item = renderItem()

  // then
  expect(item).toHaveTextContent(/^09:00–09:30 30 minStandup/)
})

it('puts the rows in order: time, title, calendar name, tags, place, participants and description', async () => {
  // given
  seedStored({ viewOptions: showAll })

  // when
  const item = renderItem()
  const calendar = await within(item).findByText('Planning calendar')

  // then
  expectInOrder([
    within(item).getByText('09:00–09:30'),
    within(item).getByText('Standup'),
    calendar,
    within(item).getByText('Work'),
    within(item).getByText('Room 4'),
    bar(item) as HTMLElement,
    within(item).getByText('Bring the forms and the results'),
  ])
})

it('shows only the time and the title when nothing of the rest is chosen', () => {
  // given
  seedStored({
    viewOptions: {
      calendar: false,
      tags: false,
      place: false,
      participants: false,
      description: false,
    },
  })

  // when
  const item = renderItem()

  // then
  expect(item).toHaveTextContent(/^09:00–09:30 30 minStandup$/)
  expect(bar(item)).toBeNull()
})

it('shows the tags, the place, the participants and the description, but not the calendar, as it is at first', () => {
  // when
  const item = renderItem()

  // then
  expect(within(item).getByText('Work')).toBeInTheDocument()
  expect(within(item).getByText('team')).toBeInTheDocument()
  expect(within(item).getByText('Room 4')).toBeInTheDocument()
  expect(bar(item)).not.toBeNull()
  expect(within(item).getByText('Bring the forms and the results')).toBeInTheDocument() // on one line
  expect(within(item).queryByText('Planning calendar')).not.toBeInTheDocument()
})

it('shows the name of the calendar when it is chosen', async () => {
  // given
  seedStored({ viewOptions: { ...defaultViewOptions, calendar: true } })

  // when
  const item = renderItem()

  // then
  expect(await within(item).findByText('Planning calendar')).toHaveClass('text-muted-foreground')
})

it('shows the answers of the participants as the bar of the detail, with how many gave each one', () => {
  // when
  const item = renderItem()

  // then
  const answers = bar(item) as HTMLElement
  expect(answers).toHaveClass('h-6') // the height of a line of text
  expect(within(answers).getByTitle('Accepted')).toHaveTextContent('2')
  expect(within(answers).getByTitle('Declined')).toHaveTextContent('1')
})

it('has no bar for an event that has no participants', () => {
  // when
  const alone = renderItem({ participants: [] })

  // then
  expect(bar(alone)).toBeNull()
})

it('says "All day" for an event without a time', () => {
  // when
  const single = renderItem({ startTime: '', endTime: '' })

  // then
  expect(single).toHaveTextContent(/^All dayStandup/)
})

it('says how many days an event without a time lasts', () => {
  // when
  const several = renderItem({ startTime: '', endTime: '', endDate: '2026-11-14' })

  // then
  expect(several).toHaveTextContent(/^3 daysStandup/)
})

it('makes every line as high as one of text, cuts the lines at their end without dots, and wraps the title and the description up to three lines at any character', () => {
  // when
  const item = renderItem()

  // then: the lines
  const content = item.querySelector('[class*="leading-6"]') as HTMLElement
  expect(content).toHaveClass('text-base', 'leading-6')
  for (const line of [
    within(item).getByText('09:00–09:30').parentElement,
    within(item).getByText('Room 4'),
  ]) {
    expect(line).toHaveClass('h-6', 'overflow-hidden', 'text-clip', 'whitespace-nowrap')
    expect(line).not.toHaveClass('truncate', 'text-ellipsis')
  }
  expect(within(item).getByText('Work').parentElement).toHaveClass('h-6', 'whitespace-nowrap')
  // then: the title and the description
  expect(within(item).getByText('Standup')).toHaveClass('line-clamp-3', 'break-all')
  expect(within(item).getByText('Bring the forms and the results')).toHaveClass(
    'line-clamp-3',
    'break-all',
  )
})

it('says the same in the agenda, the week and the timeline', async () => {
  // given
  seedStored({ viewOptions: showAll })
  const event = displayOf(source)
  const [block] = layoutBlocks([event], Temporal.PlainDate.from('2026-11-12'), 5, showAll)

  // when
  renderApp(
    <>
      <EventItem entry={{ event, start: '09:00', end: '09:30' }} onEdit={vi.fn()} />
      <EventCard entry={{ event, start: '09:00', end: '09:30' }} onEdit={vi.fn()} />
      <TimelineBlock block={block} left={0} width={300} onOpen={vi.fn()} />
    </>,
  )

  // then
  const [item, card, timeline] = await screen.findAllByRole('button', { name: /Standup/ })
  await within(item).findByText('Planning calendar')
  await within(card).findByText('Planning calendar')
  await within(timeline).findByText('Planning calendar')
  expect(card.textContent).toBe(item.textContent)
  expect(timeline.textContent).toBe(item.textContent)
})
