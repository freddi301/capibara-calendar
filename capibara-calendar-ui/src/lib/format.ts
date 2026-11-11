export function usesTwelveHours(locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 === true
}

export function formatTime(time: string, locale: string) {
  return Temporal.PlainTime.from(time).toLocaleString(locale, {
    hour: usesTwelveHours(locale) ? 'numeric' : '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(date: string, locale: string) {
  return Temporal.PlainDate.from(date).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function capitalize(text: string, locale: string) {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)
}

export function formatWeekday(day: Temporal.PlainDate, locale: string) {
  return capitalize(day.toLocaleString(locale, { weekday: 'short' }), locale)
}

export function formatFullDate(day: Temporal.PlainDate, locale: string) {
  return day.toLocaleString(locale, { dateStyle: 'full' })
}

export function formatTimeRange(start: string, end: string, locale: string) {
  if (start && end) return `${formatTime(start, locale)}–${formatTime(end, locale)}`
  return start || end ? formatTime(start || end, locale) : ''
}
