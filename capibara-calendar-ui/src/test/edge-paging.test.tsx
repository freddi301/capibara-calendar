import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { matchMediaMock } from './mocks/match-media'
import { pageTowards } from '../lib/pager-style'
import { useEdgePaging } from '../lib/use-edge-paging'

// A pager of seven rows of 100 px: the first row is from 0 to 100, the last one from 600 to 700.
function addPager() {
  const pager = document.createElement('div')
  pager.dataset.slot = 'pager'
  pager.getBoundingClientRect = () => new DOMRect(0, 0, 800, 700)
  document.body.append(pager)
  return pager
}

const point = (y: number) => fireEvent.pointerMove(window, { clientY: y })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('going to the week before or after while a card is dragged', () => {
  it('goes to the week before when the pointer is on the upper half of the first day', () => {
    addPager()
    const onPage = vi.fn()
    renderHook(() => {
      useEdgePaging(true, onPage)
    })

    point(30)
    vi.advanceTimersByTime(599)
    expect(onPage).not.toHaveBeenCalled() // it is held for a moment first
    vi.advanceTimersByTime(1)
    expect(onPage).toHaveBeenCalledExactlyOnceWith(-1)
  })

  it('goes to the week after when the pointer is on the lower half of the last day', () => {
    addPager()
    const onPage = vi.fn()
    renderHook(() => {
      useEdgePaging(true, onPage)
    })

    point(670)
    vi.advanceTimersByTime(600)
    expect(onPage).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('does not go when the pointer is on the other half of the first or of the last day, or in between', () => {
    addPager()
    const onPage = vi.fn()
    renderHook(() => {
      useEdgePaging(true, onPage)
    })

    for (const y of [60, 99, 350, 601, 640]) {
      point(y)
      vi.advanceTimersByTime(3000)
    }
    expect(onPage).not.toHaveBeenCalled()
  })

  it('goes once, and waits two seconds before it goes again if the pointer stays', () => {
    addPager()
    const onPage = vi.fn()
    renderHook(() => {
      useEdgePaging(true, onPage)
    })

    point(680)
    vi.advanceTimersByTime(600)
    expect(onPage).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1999)
    expect(onPage).toHaveBeenCalledTimes(1) // not the same week twice in a row
    vi.advanceTimersByTime(1)
    expect(onPage).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(2000)
    expect(onPage).toHaveBeenCalledTimes(3)
  })

  it('does not go if the pointer leaves before the moment is over, and starts again when it comes back', () => {
    addPager()
    const onPage = vi.fn()
    renderHook(() => {
      useEdgePaging(true, onPage)
    })

    point(20)
    vi.advanceTimersByTime(500)
    point(300)
    vi.advanceTimersByTime(5000)
    expect(onPage).not.toHaveBeenCalled()

    point(20)
    vi.advanceTimersByTime(600)
    expect(onPage).toHaveBeenCalledExactlyOnceWith(-1)
  })

  it('stops when the pointer leaves, after it went', () => {
    addPager()
    const onPage = vi.fn()
    renderHook(() => {
      useEdgePaging(true, onPage)
    })

    point(20)
    vi.advanceTimersByTime(600)
    point(300)
    vi.advanceTimersByTime(10_000)
    expect(onPage).toHaveBeenCalledTimes(1)
  })

  it('works with a finger as it does with a mouse', () => {
    addPager()
    const onPage = vi.fn()
    renderHook(() => {
      useEdgePaging(true, onPage)
    })

    fireEvent.touchMove(window, { touches: [{ clientX: 100, clientY: 690 }] })
    vi.advanceTimersByTime(600)
    expect(onPage).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('does nothing when no card is dragged, and when the drag ends', () => {
    addPager()
    const onPage = vi.fn()
    const { rerender } = renderHook(
      ({ isActive }) => {
        useEdgePaging(isActive, onPage)
      },
      { initialProps: { isActive: false } },
    )

    point(20)
    vi.advanceTimersByTime(5000)
    expect(onPage).not.toHaveBeenCalled()

    rerender({ isActive: true })
    point(20)
    vi.advanceTimersByTime(300)
    rerender({ isActive: false }) // dropped before the moment was over
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onPage).not.toHaveBeenCalled()
  })
})

describe('the week that is scrolled to', () => {
  const pagerOfHeight = (height: number) => {
    const pager = addPager()
    Object.defineProperty(pager, 'clientHeight', { value: height })
    pager.scrollTo = vi.fn()
    return pager
  }

  it('is the page after or before, with a scroll that is animated', () => {
    const pager = pagerOfHeight(300)

    pageTowards(1)
    expect(pager.scrollTo).toHaveBeenLastCalledWith({ top: 600 })
    expect(pager.style.scrollBehavior).toBe('smooth')

    pageTowards(-1)
    expect(pager.scrollTo).toHaveBeenLastCalledWith({ top: 0 })
  })

  it('is not animated when the person wants less motion', () => {
    const pager = pagerOfHeight(300)
    matchMediaMock.mockImplementationOnce((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    pageTowards(1)

    expect(pager.scrollTo).toHaveBeenCalledWith({ top: 600 })
    expect(pager.style.scrollBehavior).toBe('')
  })

  it('does nothing when there is no pager', () => {
    expect(() => {
      pageTowards(1)
    }).not.toThrow()
  })
})
