export type KeptScroll = {
  date: string
  start?: string
  scrollTop?: number
  day?: string
  offset?: number
  fraction?: number
  lefts?: Record<string, number>
}

const kept = new Map<string, KeptScroll>()

export const agendaScroll = 'agenda'
export const weekRowsScroll = 'week rows'
export const timelineScroll = (scale: string) => `timeline ${scale}`

export function keepScroll(layout: string, value: KeptScroll) {
  kept.set(layout, value)
}

export function forgetTimelineScroll() {
  for (const layout of kept.keys()) {
    if (layout.startsWith(timelineScroll(''))) kept.delete(layout)
  }
}

export function keptScroll(layout: string, date: string | undefined) {
  const found = kept.get(layout)
  return found?.date === date ? found : undefined
}
