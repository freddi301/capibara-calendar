import { createContext, useContext } from 'react'

export const ReadOnlyContext = createContext(false)

export const useReadOnly = () => useContext(ReadOnlyContext)

export const lockedSelect = { readOnly: true, open: false } as const

export function useSelectLock() {
  return useReadOnly() ? lockedSelect : {}
}
