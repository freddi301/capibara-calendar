import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { vi } from 'vitest'
import type { ListScreenProps } from '@/lib/layout'
import { renderApp } from '@/test/render'

/** Renders one of the screens that have the date line, on a date. */
export function renderListScreen(Screen: ComponentType<ListScreenProps>, date: string) {
  const handlers = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenLayouts: vi.fn(),
    onOpenCalendars: vi.fn(),
    onOpenFilters: vi.fn(),
    onOpenView: vi.fn(),
  }
  renderApp(<Screen date={date} {...handlers} />)
  return handlers
}

export const pickedDate = () => screen.getByLabelText('Choose a date')

export async function press(name: string) {
  await userEvent.click(screen.getByRole('button', { name }))
}
