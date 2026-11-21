import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { renderScreen, setUpMonth } from '@/test/support/month'

setUpMonth()

it('asks to create an event on the day that is clicked, when the day has no event', async () => {
  // given
  const handlers = renderScreen()

  // when
  await userEvent.click(
    await screen.findByRole('button', { name: 'New event: Friday, November 13, 2026' }),
  )

  // then
  expect(handlers.onCreate).toHaveBeenCalledExactlyOnceWith('2026-11-13')
  expect(handlers.onEdit).not.toHaveBeenCalled()
})

it('opens the event, and does not create one, when its card is clicked', async () => {
  // given
  const handlers = renderScreen()
  const card = await screen.findByRole('button', { name: /Solo/ })

  // when
  await userEvent.click(card)

  // then
  expect(handlers.onEdit).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ title: 'Solo' }),
  )
  expect(handlers.onCreate).not.toHaveBeenCalled()
})

it('does not create an event, nor open one, when a dot of the indicator is clicked', async () => {
  // given
  const handlers = renderScreen()

  // when
  await userEvent.click(await screen.findByRole('button', { name: 'Meeting 2' }))

  // then
  expect(handlers.onCreate).not.toHaveBeenCalled()
  expect(handlers.onEdit).not.toHaveBeenCalled()
})
