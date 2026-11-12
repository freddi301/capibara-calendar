import type { DisplayEvent } from '@/lib/display-event'

export const titleStyle = ({ status }: Pick<DisplayEvent, 'status'>) =>
  status === 'cancelled' ? 'line-through decoration-foreground/75' : undefined

export const hasMarks = ({ isRecurring, location, videoLink, hasAlerts, status }: DisplayEvent) =>
  !!(status !== 'confirmed' || isRecurring || location || videoLink || hasAlerts)
