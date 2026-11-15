import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { X } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import type { EventStatus } from '@/api/calendar-api'
import type { Item } from '@/lib/event-filter'
import { statusLabels } from '@/lib/status-labels'

/** A word that the events are compared to. */
export function TextValue({
  value,
  label,
  list,
  onChange,
}: {
  value: string
  label: string
  list?: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      value={value}
      list={list}
      aria-label={label}
      className="h-8 min-w-20 flex-1 sm:max-w-64"
      onChange={(event) => {
        onChange(event.target.value)
      }}
    />
  )
}

type ItemsValueProps = {
  items: Item[]
  /** How many can be chosen: one, or as many as wanted. */
  max?: number
  label: string
  suggestions: Item[]
  /** Whether what is typed can be used as it is, as a tag, or only what is offered, as a person. */
  isFree: boolean
  onChange: (items: Item[]) => void
}

/** Some things that the events are compared to, as chips, chosen from what is offered or typed. */
export function ItemsValue({ items, max, label, suggestions, isFree, onChange }: ItemsValueProps) {
  const { t } = useLingui()
  const [text, setText] = useState('')
  const [isFocused, setFocused] = useState(false)
  const chosen = new Set(items.map(({ value }) => value.toLowerCase()))
  const typed = text.trim().toLowerCase()
  const offered = suggestions
    .filter(
      ({ value, label: name }) =>
        !chosen.has(value.toLowerCase()) && name.toLowerCase().includes(typed),
    )
    .slice(0, 6)
  const canAdd = max === undefined || items.length < max

  const add = (item: Item) => {
    onChange(max === 1 ? [item] : [...items, item])
    setText('')
  }
  const addTyped = () => {
    const value = text.trim()
    if (!value) return
    if (offered.length > 0 && !isFree) add(offered[0])
    else if (isFree && !chosen.has(value.toLowerCase())) add({ value, label: value })
    else setText('')
  }

  return (
    <div className="flex min-w-40 flex-1 flex-col gap-1 sm:max-w-80">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-input bg-muted px-1.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        {items.map((item) => {
          const name = item.label
          return (
            <span
              key={item.value}
              className="inline-flex items-center gap-0.5 rounded-md bg-background py-0.5 pr-0.5 pl-2 text-sm"
            >
              {name}
              <button
                type="button"
                aria-label={t`Remove ${name}`}
                className="grid size-6 place-items-center rounded-md text-muted-foreground hover:text-destructive"
                onClick={() => {
                  onChange(items.filter(({ value }) => value !== item.value))
                }}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          )
        })}
        {canAdd && (
          <input
            value={text}
            aria-label={label}
            className="h-6 min-w-24 flex-1 bg-transparent text-base outline-none md:text-sm"
            onChange={(event) => {
              setText(event.target.value)
            }}
            onFocus={() => {
              setFocused(true)
            }}
            onBlur={() => {
              setFocused(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || (isFree && event.key === ',')) {
                event.preventDefault()
                addTyped()
              } else if (event.key === 'Backspace' && !text && items.length > 0) {
                onChange(items.slice(0, -1))
              }
            }}
          />
        )}
      </div>
      {isFocused && canAdd && offered.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {offered.map((item) => (
            <button
              key={item.value}
              type="button"
              className="min-h-8 rounded-full border border-input px-3 text-sm hover:bg-muted"
              // The field keeps its focus, so that the choices stay while one is chosen.
              onMouseDown={(event) => {
                event.preventDefault()
              }}
              onClick={() => {
                add(item)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const statuses: EventStatus[] = ['confirmed', 'tentative', 'cancelled']

/** The states that the events are compared to: one, or as many as wanted. */
export function StatusValue({
  items,
  max,
  onChange,
}: {
  items: Item[]
  max?: number
  onChange: (items: Item[]) => void
}) {
  const { i18n } = useLingui()
  return (
    <div className="flex flex-wrap gap-1">
      {statuses.map((status) => {
        const isOn = items.some(({ value }) => value === status)
        const label = i18n._(statusLabels[status])
        return (
          <button
            key={status}
            type="button"
            aria-pressed={isOn}
            className={cn(
              'min-h-8 rounded-full border px-3 text-sm font-medium',
              isOn
                ? 'border-foreground bg-foreground text-background'
                : 'border-input text-muted-foreground hover:bg-muted',
            )}
            onClick={() => {
              if (max === 1) onChange([{ value: status, label }])
              else if (isOn) onChange(items.filter(({ value }) => value !== status))
              else onChange([...items, { value: status, label }])
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
