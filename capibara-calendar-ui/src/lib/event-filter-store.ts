import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import {
  arityOf,
  emptyFilter,
  fields,
  groupModes,
  type FilterNode,
  type Group,
  type Rule,
} from './event-filter'

const storageKey = 'capibara-calendar-event-filter'
const changed = 'capibara-calendar-event-filter-changed'

const itemSchema = z.object({ value: z.string(), label: z.string() })

const ruleSchema = z.object({
  id: z.string(),
  kind: z.literal('rule'),
  field: z.enum(fields),
  operator: z.string(),
  text: z.string(),
  items: z.array(itemSchema),
  answer: z.enum(['', 'needs-action', 'accepted', 'declined', 'tentative']),
})

const groupSchema: z.ZodType<Group> = z.lazy(() =>
  z.object({
    id: z.string(),
    kind: z.literal('group'),
    mode: z.enum(groupModes),
    children: z.array(z.union([ruleSchema, groupSchema])),
  }),
)

/** The rules that were kept, without the ones that an operator that does not exist. */
function cleaned(group: Group): Group {
  const children = group.children.flatMap((child): FilterNode[] => {
    if (child.kind === 'group') return [cleaned(child)]
    const rule: Rule = child
    return arityOf(rule.field, rule.operator) ? [rule] : []
  })
  return { ...group, children }
}

function parse(raw: string | null): Group {
  try {
    const parsed = groupSchema.safeParse(raw && JSON.parse(raw))
    return parsed.success ? cleaned(parsed.data) : emptyFilter()
  } catch {
    return emptyFilter()
  }
}

function read() {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

export function saveEventFilter(root: Group) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(root))
  } catch {
    // storage is blocked
  }
  window.dispatchEvent(new Event(changed))
}

let seen: { raw: string | null; root: Group } | undefined
const nothing = emptyFilter()

// The same object while the stored text is the same: what a component that watches it needs.
function snapshot() {
  const raw = read()
  if (seen?.raw !== raw) seen = { raw, root: parse(raw) }
  return seen.root
}

function subscribe(onChange: () => void) {
  window.addEventListener(changed, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(changed, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** The rules that choose which events are shown. They are kept, and shared by all the screens. */
export function useEventFilter() {
  return useSyncExternalStore(subscribe, snapshot, () => nothing)
}

/** Changes the rules that are kept: the function gets them as they are now. */
export function editEventFilter(change: (root: Group) => Group) {
  saveEventFilter(change(snapshot()))
}
