import type { DisplayEvent } from '@/lib/display-event'

export const layouts = [
  'agenda',
  'weekRows',
  'timelineDay',
  'timelineWeek',
  'timelineMonth',
] as const

export type Layout = (typeof layouts)[number]

export const defaultLayout: Layout = 'agenda'

export type ListScreenProps = {
  date?: string
  onCreate: (date: string) => void
  onEdit: (event: DisplayEvent) => void
  onOpenSettings: () => void
  onOpenLayouts: (date: string) => void
  onOpenView: (date: string) => void
  onOpenCalendars: () => void
  onOpenFilters: () => void
  onDateChange?: (date: string) => void
}
