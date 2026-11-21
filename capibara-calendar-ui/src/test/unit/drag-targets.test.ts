// @vitest-environment jsdom
import type { ClientRect, Collision } from '@dnd-kit/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { collideByPointerOrCenter, moveByDay } from '@/lib/drag-targets'

// A pager of 700 px with seven days of 100 px, and the week before and after just out of sight.
const rect = (top: number, height = 100): ClientRect => ({
  top,
  bottom: top + height,
  left: 0,
  right: 800,
  width: 800,
  height,
})

const days: Record<string, ClientRect> = {
  'before-sunday': rect(-100),
  monday: rect(0),
  tuesday: rect(100),
  wednesday: rect(200),
  sunday: rect(600),
  'after-monday': rect(700),
}

beforeEach(() => {
  const pager = document.createElement('div')
  pager.dataset.slot = 'pager'
  pager.getBoundingClientRect = () => new DOMRect(0, 0, 800, 700)
  document.body.append(pager)
})

afterEach(() => {
  document.body.replaceChildren()
})

const idsOf = (collisions: Collision[]) => collisions.map(({ id }) => id)

function collide(pointer: { x: number; y: number } | null, collisionRect: ClientRect) {
  const ids = Object.keys(days)
  return idsOf(
    collideByPointerOrCenter({
      active: {
        id: 'card',
        data: { current: undefined },
        rect: { current: { initial: null, translated: null } },
      },
      collisionRect,
      droppableRects: new Map(Object.entries(days)),
      droppableContainers: ids.map((id) => ({ id })),
      pointerCoordinates: pointer,
    } as unknown as Parameters<typeof collideByPointerOrCenter>[0]),
  )
}

describe('the day that a card is over while it is dragged', () => {
  it('is the day under the pointer', () => {
    expect(collide({ x: 300, y: 130 }, rect(120, 80))).toEqual(['tuesday'])
    expect(collide({ x: 300, y: 650 }, rect(620, 80))).toEqual(['sunday'])
  })

  it('is none when the pointer is over the header: the week before is just above, and is not a day to drop on', () => {
    expect(collide({ x: 300, y: -50 }, rect(-70, 80))).toEqual([])
    expect(collide({ x: 300, y: -1 }, rect(-20, 80))).toEqual([])
  })

  it('is none when the pointer is over the bar below, where the week after is just under', () => {
    expect(collide({ x: 300, y: 750 }, rect(720, 80))).toEqual([])
    expect(collide({ x: 300, y: 701 }, rect(690, 80))).toEqual([])
  })

  it('is none when the pointer is at the side of the pager', () => {
    expect(collide({ x: 900, y: 130 }, rect(120, 80))).toEqual([])
    expect(collide({ x: -5, y: 130 }, rect(120, 80))).toEqual([])
  })

  it('is the closest of the days that are shown, with no pointer, as with the keyboard', () => {
    expect(collide(null, rect(105, 80))[0]).toBe('tuesday')
    // Next to the edge, the days that are out of sight do not count, even if they are the closest.
    expect(collide(null, rect(-10, 80))[0]).toBe('monday')
    expect(collide(null, rect(650, 80))[0]).toBe('sunday')
  })
})

describe('moving the card that is picked up with the arrows', () => {
  const shown = ['monday', 'tuesday', 'wednesday', 'sunday']
  const press = (code: string, collisionRect: ClientRect, ids = shown) => {
    const event = new KeyboardEvent('keydown', { code, cancelable: true })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    const to = moveByDay(event, {
      active: 'card',
      currentCoordinates: { x: 60, y: collisionRect.top },
      context: {
        collisionRect,
        droppableRects: new Map(Object.entries(days)),
        droppableContainers: { getEnabled: () => ids.map((id) => ({ id })) },
      },
    } as unknown as Parameters<typeof moveByDay>[1])
    return { to, preventDefault }
  }

  it('goes to the day below with the arrow down, and to the day above with the arrow up', () => {
    // The card is 80 px high, in the middle of the Tuesday row.
    expect(press('ArrowDown', rect(110, 80)).to).toEqual({ x: 60, y: 210 })
    expect(press('ArrowUp', rect(110, 80)).to).toEqual({ x: 60, y: 10 })
  })

  it('takes the key for itself when it moves the card, so that the page does not scroll', () => {
    expect(press('ArrowDown', rect(110, 80)).preventDefault).toHaveBeenCalledOnce()
  })

  it('stays where it is on the first day and on the last one: there is no day beyond that is shown', () => {
    expect(press('ArrowUp', rect(10, 80)).to).toBeUndefined()
    expect(press('ArrowDown', rect(610, 80)).to).toBeUndefined()
  })

  it('does not go to a day that is out of sight, such as the one of the week before', () => {
    const everything = [...Object.keys(days)]
    expect(press('ArrowUp', rect(10, 80), everything).to).toBeUndefined()
    expect(press('ArrowDown', rect(610, 80), everything).to).toBeUndefined()
  })

  it('does nothing for the other keys', () => {
    const { to, preventDefault } = press('ArrowRight', rect(110, 80))
    expect(to).toBeUndefined()
    expect(preventDefault).not.toHaveBeenCalled()
    expect(press('KeyA', rect(110, 80)).to).toBeUndefined()
  })
})
