import { useSyncExternalStore } from 'react'
import { isWebxdc } from './webxdc'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => isWebxdc() || navigator.onLine,
    () => true,
  )
}
