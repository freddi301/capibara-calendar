import { msg } from '@lingui/core/macro'

export const palette = [
  { color: '#2563eb', name: msg`Blue` },
  { color: '#dc2626', name: msg`Red` },
  { color: '#16a34a', name: msg`Green` },
  { color: '#d97706', name: msg`Amber` },
  { color: '#7c3aed', name: msg`Violet` },
  { color: '#0891b2', name: msg`Cyan` },
  { color: '#db2777', name: msg`Pink` },
  { color: '#65a30d', name: msg`Lime` },
  { color: '#ea580c', name: msg`Orange` },
  { color: '#0d9488', name: msg`Teal` },
  { color: '#4f46e5', name: msg`Indigo` },
  { color: '#c026d3', name: msg`Fuchsia` },
  { color: '#0284c7', name: msg`Sky` },
  { color: '#e11d48', name: msg`Rose` },
  { color: '#059669', name: msg`Emerald` },
  { color: '#9333ea', name: msg`Purple` },
  { color: '#ca8a04', name: msg`Yellow` },
  { color: '#475569', name: msg`Slate` },
  { color: '#92400e', name: msg`Brown` },
  { color: '#be123c', name: msg`Crimson` },
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
      normalizeColor(color) ?? palette[index % palette.length].color,
    ]),
  )
}

export const colorBorder = (color: string | undefined) =>
  color ? { borderLeftColor: color } : undefined

export const colorMark = { 'data-slot': 'calendar-color' } as const
