import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, expect, it } from 'vitest'
import { ApiError } from '@/api/calendar-api'
import { activateLocale } from '@/i18n'
import {
  cardIn,
  dayRows,
  dragTo,
  release,
  renderScreen,
  rowY,
  setUpWeekDrag,
  titlesOf,
} from '@/test/support/week-drag'
import { standupText } from '@/test/support/week-rows'

setUpWeekDrag()

afterEach(() => {
  toast.dismiss()
})

const message = () => document.querySelector('[data-sonner-toast]')

async function moveStandupToTuesday() {
  const view = renderScreen()
  const standup = await cardIn(dayRows.thursday, /Standup/)
  await dragTo(standup, rowY(3), rowY(1))
  release(rowY(1))
  return view
}

it('says where the event went: its title, the day that it was on in red, and the day that it is on now', async () => {
  // when
  await moveStandupToTuesday()

  // then
  await waitFor(() => {
    expect(message()).not.toBeNull()
  })
  const toastBox = message() as HTMLElement
  // the title is on a line of its own, of two at the most, bold, and not indented
  const title = toastBox.querySelector('.font-bold')
  expect(title).toHaveTextContent('Standup')
  expect(title).toHaveClass('block', 'line-clamp-2')
  // the days are two lines, each with a capital letter, and no words between them to read
  const dates = toastBox.querySelector('span[aria-hidden="true"]') as HTMLElement
  const [first, second] = [...dates.querySelectorAll('span')]
  expect(first).toHaveTextContent('Thursday, November 12, 2026')
  expect(first).toHaveClass('block', 'text-red-600')
  expect(second).toHaveTextContent('Tuesday, November 10, 2026')
  expect(second).toHaveClass('block', 'text-primary')
  expect(dates).not.toHaveTextContent(/moved/)
  // the arrow, a half circle, is in the indent of the two lines: the title has none
  expect(dates).toHaveClass('relative', 'pl-4.5')
  expect(dates.querySelector('svg')).toHaveClass('absolute', 'left-0')
  expect(title?.closest('[aria-hidden="true"]')).toBeNull()
  // a screen reader hears it as a sentence instead
  expect(toastBox).toHaveTextContent(
    'moved from Thursday, November 12, 2026 to Tuesday, November 10, 2026',
  )
  expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible()
})

it('can be closed with a button that is always there', async () => {
  // given
  await moveStandupToTuesday()
  await waitFor(() => {
    expect(message()).not.toBeNull()
  })

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  // then
  await waitFor(() => {
    expect(message()).toBeNull()
  })
})

it('puts the event back on its day with Undo, and does not say that it moved again', async () => {
  // given
  const { update } = await moveStandupToTuesday()
  await waitFor(() => {
    expect(titlesOf(dayRows.tuesday)).toContain(standupText)
  })

  // when
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))

  // then
  await waitFor(() => {
    expect(titlesOf(dayRows.thursday)).toContain(standupText)
  })
  expect(titlesOf(dayRows.tuesday)).not.toContain(standupText)
  expect(update).toHaveBeenCalledTimes(2)
  expect(update.mock.calls[1][1]).toMatchObject({ start: '2026-11-12T09:00:00' })
  // the message of the move goes away, and there is not another one that says it moved back
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })
  expect(update).toHaveBeenCalledTimes(2)
})

it('says that it was not moved, and why, when the server cannot be reached; the event stays', async () => {
  // given
  const view = renderScreen()
  view.update.mockRejectedValueOnce(new ApiError('unreachable'))
  const standup = await cardIn(dayRows.thursday, /Standup/)

  // when
  await dragTo(standup, rowY(3), rowY(1))
  release(rowY(1))

  // then
  await waitFor(() => {
    expect(message()).toHaveTextContent('StandupNot movedCannot reach the CalDAV server')
  })
  expect(titlesOf(dayRows.thursday)).toContain(standupText)
  expect(titlesOf(dayRows.tuesday)).not.toContain(standupText)
  expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
})

it('says that the event was changed on the server, when it was, and loads the list again', async () => {
  // given
  const view = renderScreen()
  view.update.mockRejectedValueOnce(new ApiError('conflict'))
  const standup = await cardIn(dayRows.thursday, /Standup/)

  // when
  await dragTo(standup, rowY(3), rowY(1))
  release(rowY(1))

  // then
  await waitFor(() => {
    expect(message()).toHaveTextContent(
      'StandupNot movedIt was changed on the server after it was loaded. The list is loaded again.',
    )
  })
  expect(titlesOf(dayRows.thursday)).toContain(standupText)
})

it('says it in Italian, in the same way', async () => {
  // given
  await activateLocale('it')
  renderScreen()
  const standup = await cardIn(/giovedì 12 novembre/, /Standup/)

  // when
  await dragTo(standup, rowY(3), rowY(1))
  release(rowY(1))

  // then
  await waitFor(() => {
    expect(message()).toHaveTextContent(
      /^Standupspostato da Giovedì 12 novembre 2026 a Martedì 10 novembre 2026Giovedì 12 novembre 2026Martedì 10 novembre 2026/,
    )
  })
  expect(screen.getByRole('button', { name: 'Annulla' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Chiudi' })).toBeVisible()
})

// Moving with the keyboard (Space, the arrows, Space) is tested in a real browser, with the server:
// jsdom has no layout, and the days that the arrows go to are the ones that the layout puts there.

it('opens the event with Enter, as a button does, and does not pick it up', async () => {
  // given
  const { onEdit, update } = renderScreen()
  const standup = await cardIn(dayRows.thursday, /Standup/)

  // when
  standup.focus()
  await userEvent.keyboard('{Enter}')

  // then
  expect(onEdit).toHaveBeenCalledOnce()
  expect(document.querySelector('[data-slot="lifted-card"]')).toBeNull()
  expect(update).not.toHaveBeenCalled()
})

it('tells a screen reader that the card can be moved, and how', async () => {
  // when
  renderScreen()
  const standup = await cardIn(dayRows.thursday, /Standup/)

  // then
  expect(standup).toHaveAttribute('aria-roledescription', 'event that can be moved to another day')
  const instructions = document.getElementById(standup.getAttribute('aria-describedby') ?? '')
  expect(instructions).toHaveTextContent(
    'To move this event to another day, press Space to pick it up, the up and down arrow keys to choose the day, and Space to drop it. Escape cancels.',
  )
})

it('does not say that a card of an event that repeats can be moved: it cannot', async () => {
  // when
  renderScreen()
  const weeklySync = await cardIn(dayRows.thursday, /Weekly sync/)

  // then
  expect(weeklySync).not.toHaveAttribute('aria-roledescription')
})
