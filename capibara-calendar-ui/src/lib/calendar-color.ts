export const palette = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#ea580c', // orange
  '#0d9488', // teal
  '#4f46e5', // indigo
  '#c026d3', // fuchsia
  '#0284c7', // sky
  '#e11d48', // rose
  '#059669', // emerald
  '#9333ea', // purple
  '#ca8a04', // yellow
  '#475569', // slate
  '#92400e', // brown
  '#be123c', // crimson
] as const

export function normalizeColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim())?.[1]
  if (!hex) return undefined
  const full = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex
  return `#${full.slice(0, 6).toLowerCase()}`
}

export function calendarColors(calendars: { url: string; color?: unknown }[]) {
  return new Map(
    calendars.map(({ url, color }, index) => [
      url,
      normalizeColor(color) ?? palette[index % palette.length],
    ]),
  )
}

export const colorBorder = (color: string | undefined) =>
  color ? { borderLeftColor: color } : undefined

export const colorMark = { 'data-slot': 'calendar-color' } as const
