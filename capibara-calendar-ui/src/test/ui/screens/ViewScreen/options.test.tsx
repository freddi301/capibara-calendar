import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import ViewScreen from '@/screens/ViewScreen'
import { defaultViewOptions, getStored, setStored, type Stored } from '@/lib/use-stored'
import { renderApp } from '@/test/render'
import { seedStored } from '@/test/support/stored'

const loadViewOptions = () => getStored().viewOptions
const saveViewOptions = (viewOptions: Partial<Stored['viewOptions']>) => {
  setStored({ viewOptions: { ...defaultViewOptions, ...viewOptions } })
}

afterEach(() => {
  localStorage.clear()
})

it('has the calendar name off and the rest on until it is chosen otherwise, and keeps what was chosen', () => {
  // given: nothing is stored yet
  expect(loadViewOptions()).toEqual({
    calendar: false,
    tags: true,
    place: true,
    participants: true,
    description: true,
  })

  // when
  saveViewOptions({ place: false })

  // then
  expect(loadViewOptions()).toEqual({ ...defaultViewOptions, place: false })
})

it('is the defaults when what was stored is not valid', () => {
  for (const stored of ['not json', null, [], { tags: 'yes', place: 1 }]) {
    // given
    seedStored({ viewOptions: stored })

    // then
    expect(loadViewOptions()).toEqual(defaultViewOptions)
  }
})

it('has a checkbox for each row of an event, in the order of the rows, and a way back', async () => {
  // given
  const onClose = vi.fn()

  // when
  renderApp(<ViewScreen onClose={onClose} />)

  // then
  expect(screen.getByRole('heading', { name: 'What to view' })).toBeInTheDocument()
  const boxes = screen.getAllByRole('checkbox')
  expect(boxes.map((box) => box.closest('label')?.textContent)).toEqual([
    'Calendar name',
    'Tags',
    'Place',
    'Participants',
    'Description',
  ])
  expect(boxes.map((box) => box.getAttribute('aria-checked'))).toEqual([
    'false',
    'true',
    'true',
    'true',
    'true',
  ])

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  // then
  expect(onClose).toHaveBeenCalledOnce()
})

it('keeps each choice as it is toggled', async () => {
  // given
  renderApp(<ViewScreen onClose={vi.fn()} />)

  // when
  await userEvent.click(screen.getByRole('checkbox', { name: 'Calendar name' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Participants' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Description' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Description' }))

  // then
  expect(loadViewOptions()).toEqual({ ...defaultViewOptions, calendar: true, participants: false })
  expect(screen.getByRole('checkbox', { name: 'Calendar name' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Participants' })).not.toBeChecked()
})
