import { msg } from '@lingui/core/macro'

/**
 * Tailwind colors that look different from each other, in the order of the grid: by hue, around the
 * color wheel from red, and the light, the medium and the dark ones of a hue together.
 */
export const palette = [
  { color: '#f87171', name: msg`Light red` },
  { color: '#dc2626', name: msg`Red` },
  { color: '#991b1b', name: msg`Dark red` },
  { color: '#f97316', name: msg`Orange` },
  { color: '#c2410c', name: msg`Dark orange` },
  { color: '#92400e', name: msg`Brown` },
  { color: '#d97706', name: msg`Amber` },
  { color: '#eab308', name: msg`Yellow` },
  { color: '#84cc16', name: msg`Lime` },
  { color: '#16a34a', name: msg`Green` },
  { color: '#166534', name: msg`Dark green` },
  { color: '#10b981', name: msg`Emerald` },
  { color: '#0f766e', name: msg`Teal` },
  { color: '#0891b2', name: msg`Cyan` },
  { color: '#0ea5e9', name: msg`Sky` },
  { color: '#0369a1', name: msg`Ocean` },
  { color: '#2563eb', name: msg`Blue` },
  { color: '#1e40af', name: msg`Navy` },
  { color: '#818cf8', name: msg`Periwinkle` },
  { color: '#7c3aed', name: msg`Violet` },
  { color: '#c084fc', name: msg`Lavender` },
  { color: '#6b21a8', name: msg`Plum` },
  { color: '#a21caf', name: msg`Magenta` },
  { color: '#f472b6', name: msg`Light pink` },
  { color: '#db2777', name: msg`Pink` },
  { color: '#f43f5e', name: msg`Rose` },
  { color: '#be123c', name: msg`Crimson` },
  { color: '#475569', name: msg`Slate` },
] as const

const firstAutomatic: string[] = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
]

/** The colors that calendars get when they have none: strong and far from each other first. */
export const automaticColors: string[] = [
  ...firstAutomatic,
  ...palette.map(({ color }) => color).filter((color) => !firstAutomatic.includes(color)),
]

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
      normalizeColor(color) ?? automaticColors[index % automaticColors.length],
    ]),
  )
}

export const colorBorder = (color: string | undefined) =>
  color ? { borderLeftColor: color } : undefined

export const eventBorder = (color: string | null) =>
  color ? { borderBottomColor: color } : undefined

export const colorMark = { 'data-slot': 'calendar-color' } as const
