import type { MouseEvent } from 'react'

export function openPicker(event: MouseEvent<HTMLInputElement>) {
  const { pointerType } = event.nativeEvent as Partial<PointerEvent>
  const isTouch = pointerType
    ? pointerType !== 'mouse'
    : window.matchMedia('(pointer: coarse)').matches // browsers that do not tell the pointer
  if (isTouch) return
  try {
    event.currentTarget.showPicker()
  } catch {
    // Not supported here, or the picker is already open.
  }
}
