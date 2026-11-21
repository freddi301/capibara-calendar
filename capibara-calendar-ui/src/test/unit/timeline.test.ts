import { describe, expect, it } from 'vitest'
import { defaultViewOptions } from '@/lib/use-stored'
import {
  axisMarks,
  blockSides,
  laneWidth,
  layoutBlocks,
  minBlockHeight,
  pixelsPerMinute,
  spanOf,
  stickyHeight,
  textLines,
} from '@/lib/timeline'
import type { CalendarEvent } from '@/test/legacy'
import { displayOf } from '@/test/server'

const origin = Temporal.PlainDate.from('2026-11-10')
const perHour = (height: number) => height / 60

// The lines are 20px high, with 8px of padding and 2px around the block: two lines are 50px.
const lines = (count: number) => count * 20 + 10

const event = (fields: Partial<CalendarEvent>) =>
  displayOf({
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

const heightOf = (blocks: ReturnType<typeof layoutBlocks>, title: string) => {
  const block = blocks.find((one) => one.event.title === title)
  if (!block) throw new Error(`no block for ${title}`)
  return block.height
}

// A description of 75 characters or more takes three lines.
const longText = 'word '.repeat(15)

describe('the timeline', () => {
  it('counts the minutes of an event from the origin day, over midnight and for all day', () => {
    // when
    const same = spanOf(event({}), origin)
    const overMidnight = spanOf(
      event({ startTime: '22:00', endDate: '2026-11-11', endTime: '02:00' }),
      origin,
    )
    const allDay = spanOf(event({ startTime: '', endTime: '', endDate: '2026-11-11' }), origin)
    const noEnd = spanOf(event({ endTime: '' }), origin)

    // then
    expect(same).toEqual({ start: 540, end: 600 })
    expect(overMidnight).toEqual({ start: 1320, end: 1560 })
    expect(allDay).toEqual({ start: 0, end: 2880 })
    expect(noEnd).toEqual({ start: 540, end: 540 })
  })

  it('makes the scale of the screen: a month is of 31 days whatever the month is', () => {
    // then
    expect(pixelsPerMinute('day', 960)).toBeCloseTo(1)
    expect(pixelsPerMinute('week', 7 * 24 * 60)).toBeCloseTo(1)
    expect(pixelsPerMinute('month', 31 * 24 * 60)).toBeCloseTo(1)
  })

  it('never makes an event less high than its time and its title, and keeps its real height for the bar', () => {
    // when
    const [short, long] = layoutBlocks(
      [
        event({ title: 'a', endTime: '09:05' }),
        event({ title: 'b', startTime: '12:00', endTime: '14:00' }),
      ],
      origin,
      perHour(60),
    )

    // then
    expect(short.height).toBe(minBlockHeight)
    expect(minBlockHeight).toBe(lines(2))
    expect(short.real).toBeCloseTo(5)
    expect(long.height).toBeCloseTo(120)
    expect(long.real).toBeCloseTo(120)
  })

  it('makes a short event as high as its content, up to six lines', () => {
    // given: the time, the title, the tags and the place are four lines
    const four = event({ endTime: '09:05', tags: 'work', location: 'Room 4' })
    // the time, the title, the tags, the place and three lines of description are seven lines
    const seven = event({
      title: 'Seven',
      endTime: '09:05',
      tags: 'work',
      location: 'Room 4',
      description: longText,
    })
    const blocks = layoutBlocks([four, seven], origin, perHour(60))

    // then
    expect(heightOf(blocks, 'Event')).toBe(lines(4))
    expect(heightOf(blocks, 'Seven')).toBe(lines(6))
    expect(heightOf(blocks, 'Seven') - 2).toBe(stickyHeight) // the lines that stay in view
  })

  it('counts a line only for the rows that the view shows', () => {
    // given
    const full = event({ endTime: '09:05', tags: 'work', location: 'Room 4' })
    const view = { ...defaultViewOptions, tags: false, place: false }

    // when
    const [block] = layoutBlocks([full], origin, perHour(60), view)

    // then: only the time and the title
    expect(block.height).toBe(minBlockHeight)
  })

  it('makes the block of an event with a color of its own as high as the border under it', () => {
    // given
    const blocks = layoutBlocks(
      [
        event({ title: 'a', endTime: '09:05' }),
        event({ title: 'b', endTime: '09:05', eventColor: '#16a34a' }),
      ],
      origin,
      perHour(60),
    )

    // then
    expect(heightOf(blocks, 'b') - heightOf(blocks, 'a')).toBe(4)
  })

  it('puts the blocks that overlap as drawn in columns, and the ones that only touch in one', () => {
    // when: at one pixel a minute, the one of 5 minutes is 58 pixels high, and goes beside the one that it is in
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

    // then
    const by = Object.fromEntries(blocks.map((block) => [block.event.title, block]))
    expect([by.long.column, by.short.column]).toEqual([0, 1])
    expect([by.long.columns, by.short.columns]).toEqual([2, 2])
    expect([by.touching.column, by.touching.columns]).toEqual([0, 2])
    expect([by.alone.column, by.alone.columns]).toEqual([0, 1])
  })

  it('does not overlap the same events when they are far from each other on a taller screen', () => {
    // when
    const spread = layoutBlocks(
      [event({ title: 'a' }), event({ title: 'b', startTime: '12:00', endTime: '13:00' })],
      origin,
      5,
    )

    // then
    expect(spread.map(({ columns }) => columns)).toEqual([1, 1])
  })

  it('puts beside each other the short events that grew taller as they are, and overlap now', () => {
    // given: 10 minutes apart, at one pixel a minute: the first is 82 pixels high, with its three lines
    const events = [
      event({ title: 'first', endTime: '09:05', location: 'Room 4' }),
      event({ title: 'second', startTime: '09:10', endTime: '09:15' }),
    ]

    // when
    const blocks = layoutBlocks(events, origin, 1)

    // then
    expect(blocks.map(({ column, columns }) => [column, columns])).toEqual([
      [0, 2],
      [1, 2],
    ])
  })

  it('gives each block the width of a column, and scrolls sideways when more than `across` are in a group', () => {
    // then
    expect(blockSides({ column: 1 }, 300, 2)).toEqual({ left: 150, width: 150 })
    expect(blockSides({ column: 3 }, 300, 2)).toEqual({ left: 450, width: 150 })
    // a lone event is not stretched over the room that there is for more columns
    expect(blockSides({ column: 0 }, 900, 3)).toEqual({ left: 0, width: 300 })
    expect(laneWidth([{ columns: 1 }, { columns: 5 }], 300, 2)).toBe(750)
    expect(laneWidth([{ columns: 1 }], 300, 2)).toBe(300)
  })

  it('marks the hours at the day scale, and the days at the others', () => {
    // when
    const hours = axisMarks('day', origin, 1, 0, 130)
    const days = axisMarks('week', origin, 0.5, 0, 1000)

    // then
    expect(hours.map(({ top, hour }) => [top, hour])).toEqual([
      [0, 0],
      [60, 1],
      [120, 2],
      [180, 3],
    ])
    expect(days.map(({ date }) => date.toString()).slice(0, 2)).toEqual([
      '2026-11-10',
      '2026-11-11',
    ])
  })

  it('has room for one line of text at least, and more as the block is higher', () => {
    // then
    expect(textLines(minBlockHeight)).toBe(2) // the time, and the title
    expect(textLines(10)).toBe(1) // there is always a line
    expect(textLines(200)).toBe(9)
  })
})
