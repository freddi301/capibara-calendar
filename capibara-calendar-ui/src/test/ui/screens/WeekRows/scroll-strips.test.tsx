import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import DayRow from '@/components/DayRow'
import { renderApp } from '@/test/render'
import { displayOf } from '@/test/server'

const event = (title: string) =>
  displayOf({
    calendarUrl: '/c/',
    uid: title,
    url: `/c/${title}.ics`,
    ics: '',
    title,
    description: '',
    startDate: '2026-11-12',
    startTime: '',
    endDate: '',
    endTime: '',
  })

// The element that watches the size, which jsdom does not have: it tells what it is told to.
let observers: { callback: ResizeObserverCallback; target?: Element }[] = []

beforeEach(() => {
  observers = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      entry: { callback: ResizeObserverCallback; target?: Element }
      constructor(callback: ResizeObserverCallback) {
        this.entry = { callback }
        observers.push(this.entry)
      }
      observe(target: Element) {
        this.entry.target = target
      }
      disconnect() {
        observers = observers.filter((observer) => observer !== this.entry)
      }
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const day = Temporal.PlainDate.from('2026-11-12')
const strips = () =>
  Object.fromEntries(
    [...document.querySelectorAll<HTMLElement>('[data-slot="scroll-shadow"]')].map((strip) => [
      strip.dataset.side ?? '',
      strip.classList.contains('opacity-100'),
    ]),
  )

function renderRow(titles: string[]) {
  renderApp(
    <DayRow
      day={day}
      isToday={false}
      isSelected={false}
      onSelect={vi.fn()}
      entries={titles.map((title) => ({ event: event(title), start: '', end: '' }))}
      onEdit={vi.fn()}
    />,
  )
}

function scrollerWith(metrics: { scrollLeft: number; clientWidth: number; scrollWidth: number }) {
  const scroller = document.querySelector<HTMLElement>('.snap-x') as HTMLElement
  for (const [name, value] of Object.entries(metrics)) {
    Object.defineProperty(scroller, name, { value, configurable: true })
  }
  return scroller
}

const measured = () => {
  act(() => {
    for (const observer of observers) observer.callback([], {} as ResizeObserver)
  })
}

it('shows a thin strip on the right edge of a row that has more cards than fit, and none on the left', () => {
  // given
  renderRow(['A', 'B', 'C'])

  // when
  scrollerWith({ scrollLeft: 0, clientWidth: 300, scrollWidth: 700 })
  measured()

  // then
  expect(strips()).toEqual({ left: false, right: true })
})

it('shows the strip on the left when the row is scrolled, and takes the right one away at the end', () => {
  // given
  renderRow(['A', 'B', 'C'])
  const scroller = scrollerWith({ scrollLeft: 0, clientWidth: 300, scrollWidth: 700 })
  measured()

  // when
  Object.defineProperty(scroller, 'scrollLeft', { value: 150, configurable: true })
  act(() => {
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
  })

  // then
  expect(strips()).toEqual({ left: true, right: true })

  // when
  Object.defineProperty(scroller, 'scrollLeft', { value: 400, configurable: true })
  act(() => {
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
  })

  // then
  expect(strips()).toEqual({ left: true, right: false })
})

it('shows no strip for a row that has all its cards in view', () => {
  // given
  renderRow(['A'])

  // when
  scrollerWith({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 })
  measured()

  // then
  expect(strips()).toEqual({ left: false, right: false })
  expect(screen.getByRole('button', { name: /A/ })).toBeInTheDocument()
})

it('makes the cards stop at their edges when the row is scrolled', () => {
  // given
  renderRow(['A'])

  // then
  expect(document.querySelector('.snap-x')).toHaveClass('snap-mandatory')
  expect(screen.getByRole('button', { name: /A/ })).toHaveClass('snap-start')
})
