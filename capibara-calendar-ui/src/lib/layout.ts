import type { CalendarEvent } from './caldav'

export const layouts = ['week', 'weekRows', 'month', 'agenda'] as const

export type Layout = (typeof layouts)[number]

export const defaultLayout: Layout = 'week'

export type ListScreenProps = {
  date?: string
  onCreate: (date: string) => void
  onEdit: (event: CalendarEvent) => void
  onOpenSettings: () => void
  onOpenLayouts: (date: string) => void
  onOpenFilter: () => void
  onDateChange?: (date: string) => void
}
