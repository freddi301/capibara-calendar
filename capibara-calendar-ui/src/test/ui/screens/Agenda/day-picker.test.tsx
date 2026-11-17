import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { pagerOf, scrollToPage } from '@/test/pager'
import {
  date,
  dayGap,
  list,
  renderScreen,
  scrollList,
  setUpAgenda,
  startOf,
} from '@/test/support/agenda'
import { seedStored, storedJson } from '@/test/support/stored'

let removeSizes: () => void

beforeEach(() => {
  seedStored({ settings: { weekStart: 'monday' } }) // the week runs from Monday 9 to Sunday 15
  removeSizes = setUpAgenda()
})

afterEach(() => {
  removeSizes()
  vi.useRealTimers()
})

const day = (label: RegExp) => screen.getByRole('button', { name: label })
const week = () => screen.getByRole('group', { name: 'Week' })
const month = () => screen.getByRole('group', { name: 'Month' })
const weekPager = () => pagerOf(week())
const monthPager = () => pagerOf(month())

it('has the week of the selected day under the date line', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  const days = within(week()).getAllByRole('button')
  expect(days).toHaveLength(7)
  expect(days[0]).toHaveAccessibleName(/^Monday, November 9, 2026/)
  expect(days[6]).toHaveAccessibleName(/^Sunday, November 15, 2026/)
  expect(day(/^Thursday, November 12/)).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('group', { name: 'Month' })).not.toBeInTheDocument()
})

it('scrolls the list to a day that is tapped in the week strip', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  await userEvent.click(day(/^Saturday, November 14/))

  // then
  expect(day(/^Saturday, November 14/)).toHaveAttribute('aria-pressed', 'true')
  expect(date()).toHaveValue('2026-11-14')
  expect(list().scrollTop).toBe(startOf('2026-11-14') + dayGap)
})

it('highlights in the strip the day that is at the top of the list while it scrolls', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  scrollList(startOf('2026-11-13') + 50)

  // then
  expect(day(/^Friday, November 13/)).toHaveAttribute('aria-pressed', 'true')

  // when
  scrollList(startOf('2026-11-16')) // the next week

  // then
  expect(within(week()).getAllByRole('button')[0]).toHaveAccessibleName(/^Monday, November 16/)
  expect(day(/^Monday, November 16/)).toHaveAttribute('aria-pressed', 'true')
})

it('counts the events of each day in the strip, also in the week that it is paged to', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(day(/^Monday, November 9, 2026$/)).toBeInTheDocument() // nothing planned: no count
  expect(day(/^Thursday, November 12, 2026: 2 events/)).toBeInTheDocument()
  expect(day(/^Saturday, November 14, 2026: 1 event$/)).toBeInTheDocument()

  // when
  await scrollToPage(weekPager(), 'x', 2)

  // then
  expect(day(/^Monday, November 16, 2026: 1 event$/)).toBeInTheDocument()
})

it('pages the strip without choosing a day or moving the list', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  const scrolled = list().scrollTop

  // when
  await scrollToPage(weekPager(), 'x', 2)

  // then
  expect(within(week()).getAllByRole('button')[0]).toHaveAccessibleName(/^Monday, November 16/)
  expect(date()).toHaveValue('2026-11-12')
  expect(list().scrollTop).toBe(scrolled)
  expect(screen.queryByRole('button', { name: /^Thursday, November 12/ })).not.toBeInTheDocument()
})

it('goes back to the week of the selected day with the Today button, after paging away', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  await scrollToPage(weekPager(), 'x', 2)

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Today' }))

  // then
  expect(day(/^Thursday, November 12/)).toHaveAttribute('aria-pressed', 'true')
  expect(date()).toHaveValue('2026-11-12')
})

it('shows the month when the chevron is pressed, and the week again when it is pressed once more', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Show the month' }))

  // then
  expect(month()).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Week' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Show the week' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Show the week' }))

  // then
  expect(week()).toBeInTheDocument()
})

it('opens on the month or on the week as it was left', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Show the month' }))
  cleanup()
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(storedJson().pickerMode).toBe('month')
  expect(month()).toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Show the week' }))
  cleanup()
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(week()).toBeInTheDocument()
})

it('pages the month without choosing a day, and chooses a day that is tapped in it', async () => {
  // given
  seedStored({ pickerMode: 'month' })
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  await scrollToPage(monthPager(), 'y', 2)

  // then
  expect(screen.getByRole('combobox', { name: 'Month: November' })).toBeInTheDocument()
  expect(date()).toHaveValue('2026-11-12')
  expect(day(/^Tuesday, December 15/)).toBeInTheDocument()

  // when
  await userEvent.click(day(/^Monday, December 14/))

  // then
  expect(date()).toHaveValue('2026-12-14')
})

it('scrolls the list to a day that is tapped in the month', async () => {
  // given
  seedStored({ pickerMode: 'month' })
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  await userEvent.click(day(/^Monday, November 16/))

  // then
  expect(date()).toHaveValue('2026-11-16')
  expect(list().scrollTop).toBe(startOf('2026-11-16') + dayGap)
})

it('starts the week on the day that was chosen, or the one of the region of the browser', async () => {
  // given
  const first = async () =>
    within(await screen.findByRole('group', { name: 'Week' })).getAllByRole('button')[0]

  // when
  seedStored({ settings: { weekStart: 'sunday' } })
  renderScreen()

  // then
  expect(await first()).toHaveAccessibleName(/^Sunday, November 8/)

  // when
  cleanup()
  seedStored({ settings: { weekStart: 'saturday' } })
  renderScreen()

  // then
  expect(await first()).toHaveAccessibleName(/^Saturday, November 7/)

  // when: the system, so the region of the browser
  cleanup()
  seedStored({ settings: {} })
  const region = vi.spyOn(window.navigator, 'language', 'get')
  region.mockReturnValue('it-IT')
  renderScreen()

  // then
  expect(await first()).toHaveAccessibleName(/^Monday, November 9/)
  region.mockRestore()
})
