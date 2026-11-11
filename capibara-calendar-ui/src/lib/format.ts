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
