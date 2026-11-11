import type { CalendarEvent } from './caldav'

export type Layout = 'week' | 'weekRows' | 'month' | 'agenda'

export const defaultLayout: Layout = 'week'

export type ListScreenProps = {
  date?: string
  onCreate: (date: string) => void
  onEdit: (event: CalendarEvent) => void
  onOpenSettings: () => void
  onOpenLayouts: (date: string) => void
}
