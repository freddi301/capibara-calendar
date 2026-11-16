import { act, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { pagerOf, scrollToPage } from './pager'
import {
  dayRows,
  dragTo,
  ghost,
  lifted,
  moveTo,
  release,
  renderScreen,
  row,
  rowY,
  setUpWeekDrag,
  settle,
  titlesOf,
  touchEnd,
  touchTo,
  wait,
} from './week-drag'

setUpWeekDrag()

it('moves an event to the day where it is dropped, at the same time', async () => {
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  await dragTo(standup, rowY(3), rowY(1)) // from Thursday to Tuesday
  release(rowY(1))

  await waitFor(() => {
    expect(titlesOf(dayRows.tuesday)).toContain('09:00–09:30Standup')
  })
  expect(titlesOf(dayRows.thursday)).not.toContain('09:00–09:30Standup')
  expect(update).toHaveBeenCalledOnce()
  expect(update.mock.calls[0][1]).toMatchObject({ start: '2026-11-10T09:00:00', duration: 'PT30M' })
  expect(update.mock.calls[0][2]).toBe('all')
})

it('moves an event of several days by the days between where it was picked up and where it is dropped', async () => {
  renderScreen()
  // The event is on Thursday, Friday and Saturday: picked up on Friday and dropped on Tuesday, it
  // goes three days back, to Monday, Tuesday and Wednesday.
  const conference = await within(row(dayRows.friday)).findByRole('button', { name: /Conference/ })

  await dragTo(conference, rowY(4), rowY(1))
  release(rowY(1))

  await waitFor(() => {
    expect(titlesOf(dayRows.monday)).toContain('Conference')
  })
  expect(titlesOf(dayRows.tuesday)).toContain('Conference')
  expect(titlesOf(dayRows.wednesday)).toContain('Conference')
  expect(titlesOf(dayRows.thursday)).not.toContain('Conference')
  expect(titlesOf(dayRows.friday)).not.toContain('Conference')
})

it('shows a red silhouette where the card was and a blue one where it goes, with nothing in them', async () => {
  renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  await dragTo(standup, rowY(3), rowY(1))

  // The card follows the pointer, with what it says.
  expect(lifted()).toHaveTextContent('Standup')
  // Where it was: red, and empty.
  expect(standup).toHaveAttribute('data-dragging')
  expect(standup).toHaveClass('bg-red-500/25', '[&>*]:invisible')
  // Where it would go: blue, in the row of the pointer, and empty.
  const target = ghost()
  expect(target).not.toBeNull()
  expect(row(dayRows.tuesday).contains(target)).toBe(true)
  expect(target).toHaveClass('bg-blue-500/25')
  expect(target).toBeEmptyDOMElement()
  for (const silhouette of [standup, target]) {
    expect(silhouette?.className).not.toMatch(
      /\b(border|outline|ring)(-|\b)(?!.*(transparent|invisible))/,
    )
  }

  release(rowY(1))
  await waitFor(() => {
    expect(ghost()).toBeNull()
  })
  expect(lifted()).toBeNull()
})

it('follows the pointer from row to row, and shows nothing on the row that the card is on', async () => {
  renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  await dragTo(standup, rowY(3), rowY(1))
  expect(row(dayRows.tuesday).contains(ghost())).toBe(true)

  await moveTo(rowY(4))
  expect(row(dayRows.friday).contains(ghost())).toBe(true)

  await moveTo(rowY(3))
  expect(ghost()).toBeNull() // the day that it is on already
})

it('does not move it when it is dropped on the day that it is on, or outside the days', async () => {
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  await dragTo(standup, rowY(3), rowY(3) + 20)
  release(rowY(3) + 20)
  await dragTo(standup, rowY(3), -300)
  release(-300)
  await settle()
  expect(update).not.toHaveBeenCalled()

  expect(update).not.toHaveBeenCalled()
  expect(titlesOf(dayRows.thursday)).toContain('09:00–09:30Standup')
  expect(lifted()).toBeNull()
})

it('puts the card back when Esc is pressed, and the day that it was over does not get it', async () => {
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  await dragTo(standup, rowY(3), rowY(1))
  expect(ghost()).not.toBeNull()
  act(() => {
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
  })
  release(rowY(1))
  await settle()

  expect(ghost()).toBeNull()
  expect(lifted()).toBeNull()
  expect(update).not.toHaveBeenCalled()
  expect(titlesOf(dayRows.thursday)).toContain('09:00–09:30Standup')
})

it('does not let an event that repeats be dragged: it has to be edited, to change one of them', async () => {
  const { update } = renderScreen()
  const weeklySync = await within(row(dayRows.thursday)).findByRole('button', {
    name: /Weekly sync/,
  })

  await dragTo(weeklySync, rowY(3), rowY(1))

  expect(lifted()).toBeNull()
  expect(ghost()).toBeNull()
  expect(weeklySync).not.toHaveAttribute('data-dragging')
  release(rowY(1))
  await settle()
  expect(update).not.toHaveBeenCalled()
  expect(within(row(dayRows.thursday)).getByRole('button', { name: /Weekly sync/ })).toBeVisible()
})

it('opens an event that is pressed, but not one that was dragged', async () => {
  const { onEdit } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  await userEvent.click(standup)
  expect(onEdit).toHaveBeenCalledOnce()

  onEdit.mockClear()
  await dragTo(standup, rowY(3), rowY(3) + 20) // picked up and put down on the same day
  release(rowY(3) + 20)
  await settle()
  expect(onEdit).not.toHaveBeenCalled()
})

it('is picked up with a finger only after a long press: a quick touch that moves is a scroll', async () => {
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  fireEvent.touchStart(standup, { touches: [{ clientX: 150, clientY: rowY(3) }] })
  act(() => {
    // Before the press is long.
    fireEvent.touchMove(standup, { touches: [{ clientX: 150, clientY: rowY(1) }] })
  })
  expect(lifted()).toBeNull()
  await wait(450)
  expect(lifted()).toBeNull() // and it does not start later, either
  touchEnd(standup, rowY(1))
  await settle()

  expect(update).not.toHaveBeenCalled()
  expect(titlesOf(dayRows.thursday)).toContain('09:00–09:30Standup')
})

it('is picked up with a finger after a long press, and moved to the day where it is let go', async () => {
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  await touchTo(standup, rowY(3), rowY(1))
  expect(lifted()).toHaveTextContent('Standup')
  expect(row(dayRows.tuesday).contains(ghost())).toBe(true)
  touchEnd(standup, rowY(1))

  await waitFor(() => {
    expect(titlesOf(dayRows.tuesday)).toContain('09:00–09:30Standup')
  })
  expect(update).toHaveBeenCalledOnce()
})

it('is still dropped on the right day when the weeks changed while it was dragged, and the card it was picked up from is gone', async () => {
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })
  const pager = pagerOf(row(dayRows.thursday))

  await dragTo(standup, rowY(3), rowY(3) + 20)
  // Two weeks later: the week where the card was is not one of the three that are there any more.
  await scrollToPage(pager, 'y', 2)
  await scrollToPage(pager, 'y', 2)
  expect(standup).not.toBeInTheDocument()
  expect(lifted()).toHaveTextContent('Standup') // it is still under the pointer
  await moveTo(rowY(1))
  release(rowY(1)) // the Tuesday of the week of 23 November

  await waitFor(() => {
    expect(update).toHaveBeenCalledOnce()
  })
  expect(update.mock.calls[0][1]).toMatchObject({ start: '2026-11-24T09:00:00' })
})
