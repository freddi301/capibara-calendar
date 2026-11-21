import { useSyncExternalStore } from 'react'

const minWidth = 1024
const minHeight = 640

const query = `(min-width: ${minWidth}px) and (min-height: ${minHeight}px)`

function subscribe(onChange: () => void) {
  const list = window.matchMedia(query)
  list.addEventListener('change', onChange)
  return () => {
    list.removeEventListener('change', onChange)
  }
}

export function useRoomyScreen() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
