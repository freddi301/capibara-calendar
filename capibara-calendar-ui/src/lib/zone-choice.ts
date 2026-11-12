export const floatingChoice = 'floating'

export function zoneHint(zone: string, appZone: string, startDate: string, startTime: string) {
  if (!zone || zone === appZone || !startTime) return ''
  try {
    const here = Temporal.PlainDateTime.from(`${startDate}T${startTime}`)
      .toZonedDateTime(zone)
      .withTimeZone(appZone)
    return `${here.toPlainTime().toString({ smallestUnit: 'minute' })} ${appZone}`
  } catch {
    return ''
  }
}
