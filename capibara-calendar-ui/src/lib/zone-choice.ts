import { groupBy, sortBy, uniqBy } from 'es-toolkit'

export const floatingChoice = 'floating'
export const systemChoice = 'system'
export const utcZone = 'UTC'

export type ZoneOption = {
  value: string
  label: string
  title?: string
  hint?: string
  hintInTrigger?: boolean
  search: string
}

export type ZoneGroup = { value: string; items: ZoneOption[] }

export function zoneOption(
  zone: string,
  extra: Partial<Pick<ZoneOption, 'label' | 'title' | 'hint' | 'hintInTrigger'>> = {},
): ZoneOption {
  const readable = zone.replaceAll('_', ' ')
  const label = extra.label ?? zone
  return {
    value: zone,
    ...extra,
    label,
    search: `${zone} ${readable} ${label} ${extra.hint ?? ''}`,
  }
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export const matchesZone = (option: ZoneOption, query: string) =>
  fold(option.search).includes(fold(query.trim()))

const prefixOf = (zone: string) => (zone.includes('/') ? zone.slice(0, zone.indexOf('/')) : '')
const restOf = (zone: string) => zone.slice(zone.indexOf('/') + 1).replaceAll('_', ' ')

/** The pinned options first, then every other zone grouped by its prefix, like Europe. */
export function zoneGroups(pinned: ZoneOption[], zones: string[], otherName: string): ZoneGroup[] {
  const first = uniqBy(pinned, ({ value }) => value)
  const taken = new Set(first.map(({ value }) => value))
  const byPrefix = groupBy(
    zones.filter((zone) => !taken.has(zone)),
    (zone) => prefixOf(zone) || otherName,
  )
  const groups = sortBy(Object.entries(byPrefix), [([name]) => name]).map(([name, list]) => ({
    value: name,
    items: list.toSorted().map((zone) => zoneOption(zone, { label: restOf(zone), title: zone })),
  }))
  return [{ value: '', items: first }, ...groups]
}

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
