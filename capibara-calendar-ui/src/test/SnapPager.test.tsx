import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { expect, it, vi } from 'vitest'
import SnapPager from '../components/SnapPager'
import { scrollToPage, sizePager } from './pager'

function setup(axis: 'x' | 'y' = 'x') {
  const onPage = vi.fn()
  const view = render(
    <SnapPager
      axis={axis}
      centerKey="a"
      onPage={onPage}
      pages={[
        <button key="before">Before</button>,
        <button key="middle">Middle</button>,
        <button key="after">After</button>,
      ]}
    />,
  )
  const pager = view.container.querySelector<HTMLElement>('[data-slot="pager"]') as HTMLElement
  sizePager(pager)
  return { onPage, pager, ...view }
}

it('shows the three pages, and only the middle one is for the person that reads or types', () => {
  setup()

  expect(screen.getByRole('button', { name: 'Middle' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Before' })).not.toBeInTheDocument() // hidden
  expect(screen.queryByRole('button', { name: 'After' })).not.toBeInTheDocument()
  expect(screen.getByText('Before').parentElement).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByText('Before').parentElement).toHaveAttribute('inert')
  expect(screen.getByText('Middle').parentElement).not.toHaveAttribute('inert')
})

it('scrolls to the sides for a horizontal pager, and up and down for a vertical one', () => {
  const horizontal = setup('x')
  expect(horizontal.pager).toHaveClass('snap-x', 'overflow-y-hidden')
  expect(horizontal.pager.children[0]).toHaveClass('w-full', 'snap-center', 'snap-always')
  horizontal.unmount()

  const vertical = setup('y')
  expect(vertical.pager).toHaveClass('snap-y', 'flex-col', 'overflow-x-hidden')
  expect(vertical.pager.children[0]).toHaveClass('h-full')
})

it('says that it stopped on the page after, or on the page before', async () => {
  const { onPage, pager } = setup()

  await scrollToPage(pager, 'x', 2)
  await scrollToPage(pager, 'x', 0)

  expect(onPage.mock.calls).toEqual([[1], [-1]])
})

it('says nothing when it stops on the middle page, or while it is still moving', async () => {
  const { onPage, pager } = setup()

  await scrollToPage(pager, 'x', 1)
  pager.scrollLeft = 450 // between the pages
  fireEvent.scroll(pager)
  fireEvent.scroll(pager)

  expect(onPage).not.toHaveBeenCalled()
})

it('goes along the other axis for a vertical pager', async () => {
  const { onPage, pager } = setup('y')

  await scrollToPage(pager, 'y', 2)

  expect(onPage).toHaveBeenCalledExactlyOnceWith(1)
})

it('goes back to the middle at once when the middle page is another, without saying anything', async () => {
  const onPage = vi.fn()
  const pages: [React.ReactNode, React.ReactNode, React.ReactNode] = ['x', 'y', 'z']
  const { container, rerender } = render(
    <SnapPager axis="x" centerKey="a" onPage={onPage} pages={pages} />,
  )
  const pager = container.querySelector<HTMLElement>('[data-slot="pager"]') as HTMLElement
  sizePager(pager)
  await scrollToPage(pager, 'x', 2)
  expect(pager.scrollLeft).toBe(600)

  rerender(<SnapPager axis="x" centerKey="b" onPage={onPage} pages={pages} />)

  expect(pager.scrollLeft).toBe(300)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 160))
  })
  expect(onPage).toHaveBeenCalledTimes(1) // only the one of the person
})

const drag = (pager: HTMLElement, from: number, to: number, pointerType = 'mouse') => {
  fireEvent.pointerDown(pager, { pointerType, button: 0, clientX: from, clientY: from })
  fireEvent.pointerMove(pager, { pointerType, clientX: to, clientY: to })
  fireEvent.pointerUp(pager, { pointerType, clientX: to, clientY: to })
}

it('is dragged by a mouse: a long drag to the left goes to the page after', async () => {
  const { onPage, pager } = setup()

  drag(pager, 250, 100)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 160))
  })

  expect(pager.scrollLeft).toBe(600)
  expect(pager.style.scrollSnapType).toBe('') // it snaps again
  expect(onPage).toHaveBeenCalledExactlyOnceWith(1)
})

it('is dragged by a mouse: a drag to the right goes to the page before, a short one stays', async () => {
  const { onPage, pager } = setup()

  drag(pager, 100, 250)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 160))
  })
  expect(onPage).toHaveBeenCalledExactlyOnceWith(-1)

  onPage.mockClear()
  pager.scrollLeft = 300
  drag(pager, 100, 120)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 160))
  })
  expect(onPage).not.toHaveBeenCalled()
})

it('is not dragged by a finger, which scrolls by itself', () => {
  const { onPage, pager } = setup()

  drag(pager, 250, 100, 'touch')

  expect(pager.scrollLeft).toBe(300)
  expect(onPage).not.toHaveBeenCalled()
})

it('does not take the end of a drag for a tap on what is under it', () => {
  const onClick = vi.fn()
  const { container } = render(
    <SnapPager
      axis="x"
      centerKey="a"
      onPage={vi.fn()}
      pages={[
        'before',
        <button key="tap" onClick={onClick}>
          Tap
        </button>,
        'after',
      ]}
    />,
  )
  const pager = container.querySelector<HTMLElement>('[data-slot="pager"]') as HTMLElement
  sizePager(pager)

  drag(pager, 250, 100)
  fireEvent.click(screen.getByRole('button', { name: 'Tap' }))
  expect(onClick).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Tap' })) // the next one is a tap
  expect(onClick).toHaveBeenCalledOnce()
})

it('is not dragged by a mouse that began on what is picked up to be moved, as the cards of a day are', async () => {
  const onPage = vi.fn()
  const { container } = render(
    <SnapPager
      axis="x"
      centerKey="a"
      onPage={onPage}
      pages={[
        <button key="before">Before</button>,
        <div key="middle">
          <button data-pager-ignore="">Movable card</button>
          <button>Plain card</button>
        </div>,
        <button key="after">After</button>,
      ]}
    />,
  )
  const pager = container.querySelector<HTMLElement>('[data-slot="pager"]') as HTMLElement
  sizePager(pager)
  const slide = async (from: Element) => {
    fireEvent.pointerDown(from, { pointerType: 'mouse', button: 0, clientX: 250, clientY: 250 })
    fireEvent.pointerMove(pager, { pointerType: 'mouse', clientX: 100, clientY: 100 })
    fireEvent.pointerUp(pager, { pointerType: 'mouse', clientX: 100, clientY: 100 })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 160))
    })
  }

  await slide(screen.getByRole('button', { name: 'Movable card' }))
  expect(onPage).not.toHaveBeenCalled()
  expect(pager.scrollLeft).toBe(300)

  await slide(screen.getByRole('button', { name: 'Plain card' }))
  expect(onPage).toHaveBeenCalledExactlyOnceWith(1) // the other card still scrolls the page
})
