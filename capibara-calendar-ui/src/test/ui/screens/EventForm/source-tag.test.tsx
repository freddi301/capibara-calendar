import { screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getApi } from '@/api'
import type { SourceKind } from '@/api/calendar-api'
import CreateEditEventScreen from '@/screens/CreateEditEventScreen'
import { renderApp } from '@/test/render'
import { calendarInfoOf, serveEvents } from '@/test/server'

const work = { url: '/work/', name: 'Work', color: '' }

beforeEach(() => {
  serveEvents([], [work])
})

/** The one source of the test server, as another kind of source with another name. */
function asSource(kind: SourceKind, name: string) {
  const { sourceId } = calendarInfoOf(work).ref
  vi.spyOn(getApi(), 'sources').mockReturnValue([{ id: sourceId, kind, name }])
}

async function openPicker(kind: SourceKind, name: string) {
  asSource(kind, name)
  renderApp(<CreateEditEventScreen onClose={vi.fn()} />)
  const picker = await screen.findByRole('combobox', { name: 'Calendar' })
  await within(picker).findByText('Work')
  return picker
}

it.each([
  ['caldav', 'caldav.example'],
  ['webcal', 'feeds.example/holidays.ics'],
] as const)('shows the name of a %s source, before its icon', async (kind, name) => {
  // given
  const picker = await openPicker(kind, name)

  // then
  const label = within(picker).getByText(name)
  expect(label).not.toHaveClass('sr-only')
  expect(label.parentElement).toHaveClass('text-muted-foreground')
  expect(picker.querySelector('svg:last-of-type')).toBeInTheDocument()
})

it.each([
  ['local', 'Local'],
  ['memory', 'Memory'],
  ['webxdc', 'Chat'],
] as const)(
  'shows only the icon of a %s source, and keeps its name for a screen reader',
  async (kind, name) => {
    // given
    const picker = await openPicker(kind, name)

    // then
    expect(within(picker).getByText(name)).toHaveClass('sr-only')
  },
)
