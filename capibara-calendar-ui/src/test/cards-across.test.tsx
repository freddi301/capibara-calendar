import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import DayRow from '../components/DayRow'
import { cardsFor } from '../lib/cards-across'
import { renderApp } from './render'
import { displayOf } from './server'

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

it('has two cards across on a phone, and as many as fit, at about the same width, on a wider window', () => {
  expect(cardsFor(360)).toBe(2)
  expect(cardsFor(390)).toBe(2)
  expect(cardsFor(500)).toBe(2)
  expect(cardsFor(520)).toBe(3)
  expect(cardsFor(768)).toBe(4)
  expect(cardsFor(1280)).toBe(6)
  expect(cardsFor(1920)).toBe(9)
  // The cards share the row: whatever the width, they stay about the same.
  for (const width of [390, 520, 768, 1024, 1280, 1920]) {
    const each = (width - 60) / cardsFor(width)
    expect(each).toBeGreaterThan(150)
    expect(each).toBeLessThanOrEqual(220)
  }
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

function scrollerWith(metrics: { scrollLeft: number; clientWidth: number; scrollWidth: number }) {
  const scroller = document.querySelector<HTMLElement>('.snap-x') as HTMLElement
  for (const [name, value] of Object.entries(metrics)) {
    Object.defineProperty(scroller, name, { value, configurable: true })
  }
  return scroller
}

it('shows a thin strip on the right edge of a row that has more cards than fit, and none on the left', () => {
  renderApp(
    <DayRow
      day={day}
      isToday={false}
      isSelected={false}
      onSelect={vi.fn()}
      entries={['A', 'B', 'C'].map((title) => ({ event: event(title), start: '', end: '' }))}
      onEdit={vi.fn()}
    />,
  )
  scrollerWith({ scrollLeft: 0, clientWidth: 300, scrollWidth: 700 })

  act(() => {
    for (const observer of observers) observer.callback([], {} as ResizeObserver)
  })

  expect(strips()).toEqual({ left: false, right: true })
})

it('shows the strip on the left when the row is scrolled, and takes the right one away at the end', () => {
  renderApp(
    <DayRow
      day={day}
      isToday={false}
      isSelected={false}
      onSelect={vi.fn()}
      entries={['A', 'B', 'C'].map((title) => ({ event: event(title), start: '', end: '' }))}
      onEdit={vi.fn()}
    />,
  )
  const scroller = scrollerWith({ scrollLeft: 0, clientWidth: 300, scrollWidth: 700 })
  act(() => {
    for (const observer of observers) observer.callback([], {} as ResizeObserver)
  })

  Object.defineProperty(scroller, 'scrollLeft', { value: 150, configurable: true })
  act(() => {
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
  })
  expect(strips()).toEqual({ left: true, right: true })

  Object.defineProperty(scroller, 'scrollLeft', { value: 400, configurable: true })
  act(() => {
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
  })
  expect(strips()).toEqual({ left: true, right: false })
})

it('shows no strip for a row that has all its cards in view', () => {
  renderApp(
    <DayRow
      day={day}
      isToday={false}
      isSelected={false}
      onSelect={vi.fn()}
      entries={[{ event: event('A'), start: '', end: '' }]}
      onEdit={vi.fn()}
    />,
  )
  scrollerWith({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 })

  act(() => {
    for (const observer of observers) observer.callback([], {} as ResizeObserver)
  })

  expect(strips()).toEqual({ left: false, right: false })
  expect(screen.getByRole('button', { name: /A/ })).toBeInTheDocument()
})

it('makes the cards stop at their edges when the row is scrolled', () => {
  renderApp(
    <DayRow
      day={day}
      isToday={false}
      isSelected={false}
      onSelect={vi.fn()}
      entries={[{ event: event('A'), start: '', end: '' }]}
      onEdit={vi.fn()}
    />,
  )

  const scroller = document.querySelector('.snap-x')
  expect(scroller).toHaveClass('snap-mandatory')
  expect(screen.getByRole('button', { name: /A/ })).toHaveClass('snap-start')
})
