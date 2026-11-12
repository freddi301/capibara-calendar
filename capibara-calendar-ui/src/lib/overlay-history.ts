import { createContext, useContext, useEffect, type RefObject } from 'react'
import type { Route } from './route-state'

export const overlayDepth = (route: Route) =>
  route.screen === 'list' ? 0 : route.screen === 'calendar' ? 2 : 1

export const routeUnder = (route: Route): Route =>
  route.screen === 'calendar'
    ? { screen: 'filter' }
    : { screen: 'list', date: 'date' in route ? route.date : undefined }

export type BackHandler = () => boolean

export const BackHandlerContext = createContext<RefObject<BackHandler | undefined> | undefined>(
  undefined,
)

export function useBackHandler(handler: BackHandler) {
  const ref = useContext(BackHandlerContext)
  useEffect(() => {
    if (!ref) return
    ref.current = handler
    return () => {
      ref.current = undefined
    }
  })
}

export const popEvent = 'popstate'
export const keyEvent = 'keydown'

export function isEscapeForScreen(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return false
  return !document.querySelector('[role="alertdialog"], [role="dialog"], [role="listbox"]')
}
