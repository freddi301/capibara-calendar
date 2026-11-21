import { act, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { pagerOf, scrollToPage } from '@/test/pager'
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
} from '@/test/support/week-drag'
import { conferenceText, standupText } from '@/test/support/week-rows'

setUpWeekDrag()

it('moves an event to the day where it is dropped, at the same time', async () => {
  // given
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  // when: from Thursday to Tuesday
  await dragTo(standup, rowY(3), rowY(1))
  release(rowY(1))

  // then
  await waitFor(() => {
    expect(titlesOf(dayRows.tuesday)).toContain(standupText)
  })
  expect(titlesOf(dayRows.thursday)).not.toContain(standupText)
  expect(update).toHaveBeenCalledOnce()
  expect(update.mock.calls[0][1]).toMatchObject({ start: '2026-11-10T09:00:00', duration: 'PT30M' })
  expect(update.mock.calls[0][2]).toBe('all')
})

it('moves an event of several days by the days between where it was picked up and where it is dropped', async () => {
  // given: the event is on Thursday, Friday and Saturday
  renderScreen()
  const conference = await within(row(dayRows.friday)).findByRole('button', { name: /Conference/ })

  // when: picked up on Friday and dropped on Tuesday, it goes three days back
  await dragTo(conference, rowY(4), rowY(1))
  release(rowY(1))

  // then: Monday, Tuesday and Wednesday
  await waitFor(() => {
    expect(titlesOf(dayRows.monday)).toContain(conferenceText)
  })
  expect(titlesOf(dayRows.tuesday)).toContain(conferenceText)
  expect(titlesOf(dayRows.wednesday)).toContain(conferenceText)
  expect(titlesOf(dayRows.thursday)).not.toContain(conferenceText)
  expect(titlesOf(dayRows.friday)).not.toContain(conferenceText)
})

it('shows a red silhouette where the card was and a blue one where it goes, with nothing in them', async () => {
  // given
  renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  // when
  await dragTo(standup, rowY(3), rowY(1))

  // then: the card follows the pointer, with what it says
  expect(lifted()).toHaveTextContent('Standup')
  // where it was: red, and empty
  expect(standup).toHaveAttribute('data-dragging')
  expect(standup).toHaveClass('bg-red-500/25', '[&>*]:invisible')
  // where it would go: blue, in the row of the pointer, and empty
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

  // when
  release(rowY(1))

  // then
  await waitFor(
    () => {
      expect(ghost()).toBeNull()
      expect(lifted()).toBeNull() // it goes in an update of its own, after the silhouette
    },
    { timeout: 5000 },
  )
})

it('follows the pointer from row to row, and shows nothing on the row that the card is on', async () => {
  // given
  renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  // when
  await dragTo(standup, rowY(3), rowY(1))

  // then
  expect(row(dayRows.tuesday).contains(ghost())).toBe(true)

  // when
  await moveTo(rowY(4))

  // then
  expect(row(dayRows.friday).contains(ghost())).toBe(true)

  // when
  await moveTo(rowY(3))

  // then: the day that it is on already
  expect(ghost()).toBeNull()
})

it('does not move it when it is dropped on the day that it is on, or outside the days', async () => {
  // given
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  // when
  await dragTo(standup, rowY(3), rowY(3) + 20)
  release(rowY(3) + 20)
  await dragTo(standup, rowY(3), -300)
  release(-300)
  await settle()

  // then
  expect(update).not.toHaveBeenCalled()
  expect(titlesOf(dayRows.thursday)).toContain(standupText)
  expect(lifted()).toBeNull()
})

it('puts the card back when Esc is pressed, and the day that it was over does not get it', async () => {
  // given
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })
  await dragTo(standup, rowY(3), rowY(1))
  expect(ghost()).not.toBeNull()

  // when
  act(() => {
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
  })
  release(rowY(1))
  await settle()

  // then
  expect(ghost()).toBeNull()
  expect(lifted()).toBeNull()
  expect(update).not.toHaveBeenCalled()
  expect(titlesOf(dayRows.thursday)).toContain(standupText)
})

it('does not let an event that repeats be dragged: it has to be edited, to change one of them', async () => {
  // given
  const { update } = renderScreen()
  const weeklySync = await within(row(dayRows.thursday)).findByRole('button', {
    name: /Weekly sync/,
  })

  // when
  await dragTo(weeklySync, rowY(3), rowY(1))
  release(rowY(1))
  await settle()

  // then
  expect(lifted()).toBeNull()
  expect(ghost()).toBeNull()
  expect(weeklySync).not.toHaveAttribute('data-dragging')
  expect(update).not.toHaveBeenCalled()
  expect(within(row(dayRows.thursday)).getByRole('button', { name: /Weekly sync/ })).toBeVisible()
})

it('opens an event that is pressed, but not one that was dragged', async () => {
  // given
  const { onEdit } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  // when
  await userEvent.click(standup)

  // then
  expect(onEdit).toHaveBeenCalledOnce()

  // when: picked up and put down on the same day
  onEdit.mockClear()
  await dragTo(standup, rowY(3), rowY(3) + 20)
  release(rowY(3) + 20)
  await settle()

  // then
  expect(onEdit).not.toHaveBeenCalled()
})

it('is picked up with a finger only after a long press: a quick touch that moves is a scroll', async () => {
  // given
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  // when: it moves before the press is long
  fireEvent.touchStart(standup, { touches: [{ clientX: 150, clientY: rowY(3) }] })
  act(() => {
    fireEvent.touchMove(standup, { touches: [{ clientX: 150, clientY: rowY(1) }] })
  })

  // then
  expect(lifted()).toBeNull()

  // when
  await wait(450)

  // then: and it does not start later, either
  expect(lifted()).toBeNull()

  // when
  touchEnd(standup, rowY(1))
  await settle()

  // then
  expect(update).not.toHaveBeenCalled()
  expect(titlesOf(dayRows.thursday)).toContain(standupText)
})

it('is picked up with a finger after a long press, and moved to the day where it is let go', async () => {
  // given
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })

  // when
  await touchTo(standup, rowY(3), rowY(1))

  // then
  expect(lifted()).toHaveTextContent('Standup')
  expect(row(dayRows.tuesday).contains(ghost())).toBe(true)

  // when
  touchEnd(standup, rowY(1))

  // then
  await waitFor(() => {
    expect(titlesOf(dayRows.tuesday)).toContain(standupText)
  })
  expect(update).toHaveBeenCalledOnce()
})

it('is still dropped on the right day when the weeks changed while it was dragged, and the card it was picked up from is gone', async () => {
  // given
  const { update } = renderScreen()
  const standup = await within(row(dayRows.thursday)).findByRole('button', { name: /Standup/ })
  const pager = pagerOf(row(dayRows.thursday))
  await dragTo(standup, rowY(3), rowY(3) + 20)

  // when: two weeks later, the week where the card was is not one of the three that are there any more
  await scrollToPage(pager, 'y', 2)
  await scrollToPage(pager, 'y', 2)

  // then
  expect(standup).not.toBeInTheDocument()
  expect(lifted()).toHaveTextContent('Standup') // it is still under the pointer

  // when: the Tuesday of the week of 23 November
  await moveTo(rowY(1))
  release(rowY(1))

  // then
  await waitFor(() => {
    expect(update).toHaveBeenCalledOnce()
  })
  expect(update.mock.calls[0][1]).toMatchObject({ start: '2026-11-24T09:00:00' })
})
