import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import EventCard from '../components/EventCard'
import EventItem from '../components/EventItem'
import type { CalendarEvent } from '../lib/caldav'
import { defaultViewOptions, loadViewOptions, saveViewOptions } from '../lib/view-options'
import ViewScreen from '../screens/ViewScreen'
import { renderApp } from './render'

const event: CalendarEvent = {
  calendarUrl: '/c/',
  uid: '1',
  url: '/c/1.ics',
  ics: '',
  title: 'Standup',
  description: 'Bring the forms\nand the results',
  startDate: '2026-11-12',
  startTime: '09:00',
  endDate: '',
  endTime: '',
  location: 'Room 4',
  tags: 'Work, team',
}
const entry = { event, start: '09:00', end: '' }

afterEach(() => {
  localStorage.clear()
})

it('has all of it chosen until it is chosen otherwise, and keeps what was chosen', () => {
  expect(loadViewOptions()).toEqual(defaultViewOptions)

  saveViewOptions({ tags: true, place: false, description: true })

  expect(loadViewOptions()).toEqual({ tags: true, place: false, description: true })
})

it('is all of it when what was stored is not valid', () => {
  for (const stored of ['not json', 'null', '[]', '{"tags":"yes","place":1}']) {
    localStorage.setItem('capibara-calendar-view', stored)
    expect(loadViewOptions()).toEqual(defaultViewOptions)
  }
})

it('has a checkbox for the tags, the place and the description, and a way back', async () => {
  const onClose = vi.fn()
  renderApp(<ViewScreen onClose={onClose} />)

  expect(screen.getByRole('heading', { name: 'What to view' })).toBeInTheDocument()
  for (const name of ['Tags', 'Place', 'Description']) {
    expect(screen.getByRole('checkbox', { name })).toBeChecked()
  }
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(onClose).toHaveBeenCalledOnce()
})

it('keeps each choice as it is toggled', async () => {
  renderApp(<ViewScreen onClose={vi.fn()} />)

  await userEvent.click(screen.getByRole('checkbox', { name: 'Tags' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Description' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Description' }))

  expect(loadViewOptions()).toEqual({ tags: false, place: true, description: true })
  expect(screen.getByRole('checkbox', { name: 'Tags' })).not.toBeChecked()
})

it('shows only the title in an item of a list, when nothing of the rest is chosen', () => {
  saveViewOptions({ tags: false, place: false, description: false })
  renderApp(<EventItem entry={entry} onEdit={vi.fn()} />)

  const item = screen.getByRole('button')
  expect(item).toHaveTextContent('Standup')
  expect(item).not.toHaveTextContent('Room 4')
  expect(item).not.toHaveTextContent('Work')
  expect(item).not.toHaveTextContent('Bring the forms')
})

it('shows the tags, the place and the description under the title, as it is at first', () => {
  renderApp(<EventItem entry={entry} onEdit={vi.fn()} />)

  const item = screen.getByRole('button')
  expect(within(item).getByText('Work')).toBeInTheDocument()
  expect(within(item).getByText('team')).toBeInTheDocument()
  expect(within(item).getByText('Room 4')).toBeInTheDocument()
  expect(within(item).getByText('Bring the forms and the results')).toBeInTheDocument() // on one line
})

it('shows only the place when only the place is chosen', () => {
  saveViewOptions({ tags: false, place: true, description: false })
  renderApp(<EventItem entry={entry} onEdit={vi.fn()} />)

  const item = screen.getByRole('button')
  expect(item).toHaveTextContent('Room 4')
  expect(item).not.toHaveTextContent('Work')
  expect(item).not.toHaveTextContent('Bring the forms')
})

it('has two lines for the title in a card and one for the rest, when there is a rest to show', () => {
  saveViewOptions({ tags: true, place: true, description: false })
  renderApp(<EventCard entry={entry} onEdit={vi.fn()} />)

  expect(screen.getByText('Standup')).toHaveClass('line-clamp-2')
  expect(screen.getByText('Work, team · Room 4')).toHaveClass('truncate') // what fits of it
})

it('has all three lines for the title in a card of an event that has none of the rest to show', () => {
  renderApp(
    <EventCard
      entry={{ ...entry, event: { ...event, location: '', tags: '', description: '' } }}
      onEdit={vi.fn()}
    />,
  )

  expect(screen.getByText('Standup')).toHaveClass('line-clamp-3')
  expect(screen.getByRole('button').querySelectorAll('.truncate')).toHaveLength(1) // only the time
})

it('has all three lines for the title in a card when the rest is chosen but the event has none of it', () => {
  saveViewOptions({ tags: true, place: false, description: false })
  renderApp(<EventCard entry={{ ...entry, event: { ...event, tags: '' } }} onEdit={vi.fn()} />)

  expect(screen.getByText('Standup')).toHaveClass('line-clamp-3') // nothing to put in the third line
})

it('has three lines for the description in an item of a list', () => {
  renderApp(<EventItem entry={entry} onEdit={vi.fn()} />)

  expect(screen.getByText('Bring the forms and the results')).toHaveClass('line-clamp-3')
})

it('has one line for the tags and one for the place, when they are shown', () => {
  renderApp(<EventItem entry={entry} onEdit={vi.fn()} />)

  const item = screen.getByRole('button')
  expect(within(item).getByText('Work').parentElement).toHaveClass('whitespace-nowrap') // the tags in a row
  expect(within(item).getByText('Room 4')).toHaveClass('truncate')
})
