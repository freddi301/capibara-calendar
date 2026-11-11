export function giveSizes() {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-index') ? 100 : 1000
    },
  })
  return () => {
    Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
  }
}
