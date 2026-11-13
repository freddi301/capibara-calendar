import type { ParticipationStatus } from '@/api/calendar-api'

export const participationSegments: { status: ParticipationStatus; color: string }[] = [
  {
    status: 'accepted',
    color: 'bg-green-200 text-green-900 dark:bg-green-700/40 dark:text-green-100',
  },
  { status: 'needs-action', color: 'bg-muted-foreground/20 text-foreground' },
  {
    status: 'tentative',
    color: 'bg-amber-200 text-amber-900 dark:bg-yellow-600/35 dark:text-yellow-100',
  },
  { status: 'declined', color: 'bg-red-200 text-red-900 dark:bg-red-700/45 dark:text-red-100' },
]

export const segmentStyle =
  'flex basis-0 items-center justify-center overflow-hidden text-sm font-medium whitespace-nowrap tabular-nums transition-[flex-grow,min-width] duration-[250ms] ease-in-out'
