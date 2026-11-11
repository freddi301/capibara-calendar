import { useEffect } from 'react'

/** Tells, when it changes, the date that a screen shows. */
export function useReportDate(date: Temporal.PlainDate, onDateChange?: (date: string) => void) {
  const iso = date.toString()
  useEffect(() => {
    onDateChange?.(iso)
  }, [iso, onDateChange])
}
