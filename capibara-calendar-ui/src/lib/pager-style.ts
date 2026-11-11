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
