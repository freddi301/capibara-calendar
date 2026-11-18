import type { DisplayEvent } from '@/lib/display-event'

export type TimelineScale = 'day' | 'week' | 'month'

const hoursOnScreen: Record<TimelineScale, number> = {
  day: 16,
  week: 7 * 24,
  month: 31 * 24,
}

export const daysOnScreen = (scale: TimelineScale) => hoursOnScreen[scale] / 24

export const stickyHeight = 160

export const minBlockHeight = 52

const minutesPerDay = 24 * 60
const blockPadding = 8
const lineHeight = 20

export const pixelsPerMinute = (scale: TimelineScale, screenHeight: number) =>
  screenHeight / (hoursOnScreen[scale] * 60)

const dayIndex = (origin: Temporal.PlainDate, date: string) =>
  origin.until(Temporal.PlainDate.from(date), { largestUnit: 'days' }).days

function minuteOfDay(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export const daysBetween = (from: Temporal.PlainDate, to: Temporal.PlainDate) =>
  dayIndex(from, to.toString())

export const minuteOf = (origin: Temporal.PlainDate, date: string, time: string) =>
  dayIndex(origin, date) * minutesPerDay + minuteOfDay(time)

export function spanOf(event: DisplayEvent, origin: Temporal.PlainDate) {
  const first = dayIndex(origin, event.startDate)
  if (!event.startTime) {
    const last = dayIndex(origin, event.endDate || event.startDate)
    return { start: first * minutesPerDay, end: (last + 1) * minutesPerDay }
  }
  const start = first * minutesPerDay + minuteOfDay(event.startTime)
  if (!event.endTime) return { start, end: start }
  const end =
    dayIndex(origin, event.endDate || event.startDate) * minutesPerDay + minuteOfDay(event.endTime)
  return { start, end: Math.max(start, end) }
}

export type Block = {
  event: DisplayEvent
  top: number
  height: number
  real: number
  column: number
  columns: number
}

export function layoutBlocks(
  events: DisplayEvent[],
  origin: Temporal.PlainDate,
  perMinute: number,
): Block[] {
  const blocks = events
    .map((event) => {
      const { start, end } = spanOf(event, origin)
      const real = (end - start) * perMinute
      const height = Math.max(real, minBlockHeight)
      return {
        event,
        top: start * perMinute,
        height,
        real: Math.min(real, height),
        column: 0,
        columns: 1,
      }
    })
    .sort(
      (a, b) =>
        a.top - b.top ||
        b.height - a.height ||
        a.event.title.localeCompare(b.event.title) ||
        a.event.key.localeCompare(b.event.key),
    )

  let group: Block[] = []
  let bottoms: number[] = []
  let groupBottom = -Infinity
  const close = () => {
    for (const block of group) block.columns = bottoms.length
    group = []
    bottoms = []
  }
  for (const block of blocks) {
    if (block.top >= groupBottom - 0.5) close()
    let column = bottoms.findIndex((bottom) => bottom <= block.top + 0.5)
    if (column < 0) column = bottoms.length
    bottoms[column] = block.top + block.height
    block.column = column
    group.push(block)
    groupBottom =
      group.length === 1
        ? block.top + block.height
        : Math.max(groupBottom, block.top + block.height)
  }
  close()
  return blocks
}

export function blockSides(block: Pick<Block, 'column'>, width: number, across: number) {
  const each = width / across
  return { left: block.column * each, width: each }
}

export function laneWidth(blocks: Pick<Block, 'columns'>[], width: number, across: number) {
  const most = blocks.reduce((max, { columns }) => Math.max(max, columns), 1)
  return Math.max(width, (width / across) * most)
}

export const blocksBetween = (blocks: Block[], from: number, to: number) =>
  blocks.filter(({ top, height }) => top < to && top + height > from)

export type AxisMark = { top: number; date: Temporal.PlainDate; hour?: number }

export function axisMarks(
  scale: TimelineScale,
  origin: Temporal.PlainDate,
  perMinute: number,
  from: number,
  to: number,
): AxisMark[] {
  const step = scale === 'day' ? 60 : minutesPerDay
  const first = Math.max(Math.floor(from / perMinute / step), -100000)
  const last = Math.ceil(to / perMinute / step)
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => {
    const mark = first + index
    const minute = mark * step
    const days = Math.floor(minute / minutesPerDay)
    const hour = scale === 'day' ? (minute - days * minutesPerDay) / 60 : undefined
    return { top: minute * perMinute, date: origin.add({ days }), hour }
  })
}

export const textLines = (height: number) =>
  Math.max(1, Math.floor((height - blockPadding) / lineHeight))

export const textLineHeight = lineHeight
