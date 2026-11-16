import { isMotionReduced } from './motion'

export function pageTowards(direction: 1 | -1) {
  const node = document.querySelector<HTMLElement>('[data-slot="pager"]')
  if (!node) return
  if (!isMotionReduced()) pagerStyle.release(node)
  node.scrollTo({ top: node.clientHeight * (1 + direction) })
}

export const pagerStyle = {
  free: (node: HTMLElement) => {
    node.style.scrollSnapType = 'none'
  },
  release: (node: HTMLElement) => {
    node.style.scrollSnapType = ''
    node.style.scrollBehavior = 'smooth'
  },
  reset: (node: HTMLElement) => {
    node.style.scrollBehavior = ''
  },
}
