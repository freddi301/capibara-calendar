import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '@/lib/caldav'
import {
  axisMarks,
  blockSides,
  laneWidth,
  layoutBlocks,
  minBlockHeight,
  pixelsPerMinute,
  spanOf,
  textLines,
} from '@/lib/timeline'

const origin = Temporal.PlainDate.from('2026-11-10')
const perHour = (height: number) => height / 60

const event = (fields: Partial<CalendarEvent>): CalendarEvent => ({
  uid: fields.title ?? 'event',
  url: 'calendar',
  ics: '',
  calendarUrl: 'calendar',
  title: 'Event',
  description: '',
  startDate: '2026-11-10',
  startTime: '09:00',
  endDate: '',
  endTime: '10:00',
  ...fields,
})

describe('the timeline', () => {
  it('counts the minutes of an event from the origin day, over midnight and for all day', () => {
    expect(spanOf(event({}), origin)).toEqual({ start: 540, end: 600 })
    expect(
      spanOf(event({ startTime: '22:00', endDate: '2026-11-11', endTime: '02:00' }), origin),
    ).toEqual({
      start: 1320,
      end: 1560,
    })
    expect(spanOf(event({ startTime: '', endTime: '', endDate: '2026-11-11' }), origin)).toEqual({
      start: 0,
      end: 2880,
    })
    expect(spanOf(event({ endTime: '' }), origin)).toEqual({ start: 540, end: 540 })
  })

  it('makes the scale of the screen: a month is of 31 days whatever the month is', () => {
    expect(pixelsPerMinute('day', 720)).toBeCloseTo(1)
    expect(pixelsPerMinute('week', 7 * 24 * 60)).toBeCloseTo(1)
    expect(pixelsPerMinute('month', 31 * 24 * 60)).toBeCloseTo(1)
  })

  it('never makes an event less high than a line, and keeps its real height for the bar', () => {
    const [short, long] = layoutBlocks(
      [
        event({ title: 'a', endTime: '09:05' }),
        event({ title: 'b', startTime: '12:00', endTime: '14:00' }),
      ],
      origin,
      perHour(60),
    )
    expect(short.height).toBe(minBlockHeight)
    expect(short.real).toBeCloseTo(5)
    expect(long.height).toBeCloseTo(120)
    expect(long.real).toBeCloseTo(120)
  })

  it('puts the blocks that overlap as drawn in columns, and the ones that only touch in one', () => {
    // At one pixel a minute, the one of 5 minutes is 44 pixels high: it goes beside the one that it is in.
    const blocks = layoutBlocks(
      [
        event({ title: 'long', endTime: '10:00' }),
        event({ title: 'short', startTime: '09:30', endTime: '09:35' }),
        event({ title: 'touching', startTime: '10:00', endTime: '11:00' }),
        event({ title: 'alone', startTime: '15:00', endTime: '16:00' }),
      ],
      origin,
      1,
    )
    const by = Object.fromEntries(blocks.map((block) => [block.event.title, block]))
    expect([by.long.column, by.short.column]).toEqual([0, 1])
    expect([by.long.columns, by.short.columns]).toEqual([2, 2])
    expect([by.touching.column, by.touching.columns]).toEqual([0, 2])
    expect([by.alone.column, by.alone.columns]).toEqual([0, 1])

    // The same events, far from each other on a taller screen, do not overlap.
    const spread = layoutBlocks(
      [event({ title: 'a' }), event({ title: 'b', startTime: '12:00', endTime: '13:00' })],
      origin,
      5,
    )
    expect(spread.map(({ columns }) => columns)).toEqual([1, 1])
  })

  it('shares the width among the columns, and scrolls sideways when more than `across` are in a group', () => {
    expect(blockSides({ column: 1, columns: 2 }, 300, 2)).toEqual({ left: 150, width: 150 })
    expect(blockSides({ column: 3, columns: 5 }, 300, 2)).toEqual({ left: 450, width: 150 })
    expect(laneWidth([{ columns: 1 }, { columns: 5 }], 300, 2)).toBe(750)
    expect(laneWidth([{ columns: 1 }], 300, 2)).toBe(300)
  })

  it('marks the hours at the day scale, and the days at the others', () => {
    const hours = axisMarks('day', origin, 1, 0, 130)
    expect(hours.map(({ top, hour }) => [top, hour])).toEqual([
      [0, 0],
      [60, 1],
      [120, 2],
      [180, 3],
    ])
    const days = axisMarks('week', origin, 0.5, 0, 1000)
    expect(days.map(({ date }) => date.toString()).slice(0, 2)).toEqual([
      '2026-11-10',
      '2026-11-11',
    ])
  })

  it('has room for one line of text at least, and more as the block is higher', () => {
    expect(textLines(minBlockHeight)).toBe(2) // the title, and the line under it
    expect(textLines(10)).toBe(1) // the title is always there
    expect(textLines(200)).toBe(12)
  })
})
