import type { MouseEvent } from 'react'

export function openPicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker()
  } catch {
    // Not supported here, or the picker is already open.
  }
}
