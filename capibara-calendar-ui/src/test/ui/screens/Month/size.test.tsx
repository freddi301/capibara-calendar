import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { renderScreen, setScreenSize, setUpMonth } from '@/test/support/month'

setUpMonth()

it('shows the grid of the month on a screen that is big enough, with the weeks around it', async () => {
  // when
  renderScreen()

  // then
  const grid = await screen.findByRole('grid', { name: 'November 2026' })
  expect(grid).toBeInTheDocument()
  expect(screen.getAllByRole('row')).toHaveLength(15) // from the week of 1 October to 6 December
  expect(screen.queryByText('Screen is too small, use another view')).not.toBeInTheDocument()
})

it('says that the screen is too small, and shows no grid, with the bars still there', () => {
  // given
  setScreenSize(false)

  // when
  renderScreen()

  // then
  expect(screen.getByText('Screen is too small, use another view')).toBeInTheDocument()
  expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Layouts' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New event' })).toBeInTheDocument()
})

it('asks for the week layout with the button of the message', async () => {
  // given
  setScreenSize(false)
  const handlers = renderScreen()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Week' }))

  // then
  expect(handlers.onChooseLayout).toHaveBeenCalledWith('weekRows')
})

it('moves to the next and the previous month with the date line', async () => {
  // given
  renderScreen()
  await screen.findByRole('grid', { name: 'November 2026' })

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Next month' }))

  // then
  expect(await screen.findByRole('grid', { name: 'December 2026' })).toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
  await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))

  // then
  expect(await screen.findByRole('grid', { name: 'October 2026' })).toBeInTheDocument()
})
