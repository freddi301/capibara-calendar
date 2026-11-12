import { useState } from 'react'

export function useLeaveGuard(isDirty: boolean, onLeave: () => void) {
  const [isAsking, setAsking] = useState(false)

  return {
    isAsking,
    leave: () => {
      if (isDirty) {
        setAsking(true)
        return false
      }
      onLeave()
      return true
    },
    /** The person wants to keep what they have. */
    stay: () => {
      setAsking(false)
    },
    /** The person does not need it. */
    discard: () => {
      setAsking(false)
      onLeave()
    },
  }
}

export type LeaveGuard = ReturnType<typeof useLeaveGuard>
