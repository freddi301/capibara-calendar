import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useSwipe } from '../lib/swipe'

function Area({ onSwipe, onTap }: { onSwipe: (direction: 1 | -1) => void; onTap: () => void }) {
  const swipe = useSwipe(onSwipe)
  return (
    <div {...swipe} data-testid="area">
      <button onClick={onTap}>Tap</button>
      <div data-testid="scroller" style={{ overflowX: 'auto' }}>
        <span>Wide</span>
      </div>
    </div>
  )
}

function setup() {
  const onSwipe = vi.fn()
  const onTap = vi.fn()
  render(<Area onSwipe={onSwipe} onTap={onTap} />)
  return { onSwipe, onTap }
}

const drag = (target: Element, from: number, to: number) => {
  fireEvent.pointerDown(target, { clientX: from, clientY: 50 })
  fireEvent.pointerUp(target, { clientX: to, clientY: 50 })
}

it('reports 1 for a swipe to the left and -1 for a swipe to the right', () => {
  const { onSwipe } = setup()

  drag(screen.getByTestId('area'), 200, 100)
  drag(screen.getByTestId('area'), 100, 200)

  expect(onSwipe.mock.calls).toEqual([[1], [-1]])
})

it('ignores moves that are short, or cancelled', () => {
  const { onSwipe } = setup()
  const area = screen.getByTestId('area')

  drag(area, 200, 170)
  fireEvent.pointerDown(area, { clientX: 200, clientY: 50 })
  fireEvent.pointerCancel(area)
  fireEvent.pointerUp(area, { clientX: 50, clientY: 50 })

  expect(onSwipe).not.toHaveBeenCalled()
})

it('leaves the swipes that start on something that scrolls sideways to it', () => {
  const { onSwipe } = setup()
  const scroller = screen.getByTestId('scroller')
  const size = (scrollWidth: number) => {
    Object.defineProperty(scroller, 'scrollWidth', { value: scrollWidth, configurable: true })
    Object.defineProperty(scroller, 'clientWidth', { value: 200, configurable: true })
  }
  size(500)

  drag(screen.getByText('Wide'), 200, 50)
  expect(onSwipe).not.toHaveBeenCalled()

  // When there is nothing more to scroll to, it is a swipe again.
  size(200)
  drag(screen.getByText('Wide'), 200, 50)
  expect(onSwipe).toHaveBeenCalledExactlyOnceWith(1)
})

it('does not count the end of a swipe on a button as a tap on it', () => {
  const { onSwipe, onTap } = setup()
  const button = screen.getByRole('button', { name: 'Tap' })

  drag(button, 200, 50)
  fireEvent.click(button)
  expect(onSwipe).toHaveBeenCalledOnce()
  expect(onTap).not.toHaveBeenCalled()

  fireEvent.click(button) // the next one is a real tap
  expect(onTap).toHaveBeenCalledOnce()
})
