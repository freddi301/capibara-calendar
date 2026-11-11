import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { createEvent, listEvents } from '../lib/caldav'
import { renderApp } from './render'

vi.mock('../lib/caldav')

beforeEach(() => {
  vi.mocked(listEvents).mockResolvedValue([{ uid: '1', title: 'Dentist', date: '2026-11-12' }])
  vi.mocked(createEvent).mockResolvedValue()
})

it('shows the connection status and the events', async () => {
  renderApp(<App />)
  expect(await screen.findByText('Dentist')).toBeInTheDocument()
  expect(screen.getByText('2026-11-12')).toBeInTheDocument()
  expect(screen.getByText('Connected to the CalDAV server')).toBeInTheDocument()
})

it('reports when the server cannot be reached', async () => {
  vi.mocked(listEvents).mockRejectedValue(new Error('offline'))
  renderApp(<App />)
  expect(await screen.findByText('Cannot reach the CalDAV server')).toBeInTheDocument()
})

it('creates a whole-day event from the form', async () => {
  renderApp(<App />)
  await userEvent.type(await screen.findByLabelText('Title'), 'Lunch')
  await userEvent.click(screen.getByRole('button', { name: 'Add event' }))

  expect(createEvent).toHaveBeenCalledWith(
    { title: 'Lunch', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
    expect.anything(),
  )
})

it('asks for a title before creating an event', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Add event' }))

  expect(await screen.findByText('Enter a title')).toBeInTheDocument()
  expect(createEvent).not.toHaveBeenCalled()
})
