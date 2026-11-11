import { useState } from 'react'

export function useLeaveGuard(isDirty: boolean, onLeave: () => void) {
  const [isAsking, setAsking] = useState(false)

  return {
    isAsking,
    /** Leaves, or asks first when there is something to lose. */
    leave: () => {
      if (isDirty) setAsking(true)
      else onLeave()
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
