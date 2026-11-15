import type { CalendarEvent, EventStatus, ParticipationStatus } from '@/api/calendar-api'

/**
 * The rules that choose which events are shown: a tree of groups and rules.
 *
 * A group says how the rules in it combine: all of them match, at least one matches, none matches, or
 * at least one does not match. A rule is about one field of the event. A rule that is not finished,
 * as a "contains" with no word, and a group that has none that are finished, are left out, so that
 * the events do not disappear while the rules are being made.
 */

export const fields = ['title', 'location', 'notes', 'tags', 'people', 'status'] as const
export type Field = (typeof fields)[number]

export const groupModes = ['all', 'any', 'none', 'notAll'] as const
export type GroupMode = (typeof groupModes)[number]

/** What an operator needs after it: a text, one thing, some things, or nothing. */
export type Arity = 'text' | 'one' | 'many' | 'none'

const textOperators = {
  contains: 'text',
  notContains: 'text',
  is: 'text',
  isNot: 'text',
  startsWith: 'text',
  endsWith: 'text',
  notEmpty: 'none',
  empty: 'none',
} as const

const listOperators = {
  has: 'one',
  hasNot: 'one',
  anyOf: 'many',
  allOf: 'many',
  noneOf: 'many',
  notEmpty: 'none',
  empty: 'none',
} as const

const statusOperators = { is: 'one', isNot: 'one', in: 'many', notIn: 'many' } as const

export const operatorsOf: Record<Field, Record<string, Arity>> = {
  title: textOperators,
  location: textOperators,
  notes: textOperators,
  tags: listOperators,
  people: listOperators,
  status: statusOperators,
}

const defaultOperator: Record<Field, string> = {
  title: 'contains',
  location: 'is',
  notes: 'contains',
  tags: 'has',
  people: 'has',
  status: 'is',
}

export const arityOf = (field: Field, operator: string): Arity | undefined =>
  operatorsOf[field][operator]

/** The answers that a person can have given. Empty is any answer. */
export type Answer = '' | ParticipationStatus

/** A thing that a rule is about: its value, and the name that is shown, as a person's name. */
export type Item = { value: string; label: string }

export type Rule = {
  id: string
  kind: 'rule'
  field: Field
  operator: string
  /** For the operators that need a text. */
  text: string
  /** For the operators that need one thing or some things. */
  items: Item[]
  /** For the people: the answer that they gave. */
  answer: Answer
}

export type Group = { id: string; kind: 'group'; mode: GroupMode; children: FilterNode[] }
export type FilterNode = Rule | Group

const newId = () => crypto.randomUUID()

export const newRule = (field: Field): Rule => ({
  id: newId(),
  kind: 'rule',
  field,
  operator: defaultOperator[field],
  text: '',
  items: field === 'status' ? [{ value: 'confirmed', label: 'confirmed' }] : [],
  answer: '',
})

export const newGroup = (mode: GroupMode = 'all', children: FilterNode[] = []): Group => ({
  id: newId(),
  kind: 'group',
  mode,
  children,
})

export const emptyFilter = (): Group => newGroup('all')

/** The group that is added in another: the way that is not the one that is already there, mostly. */
export const groupToAdd = (isInTheRoot: boolean): Group => newGroup(isInTheRoot ? 'any' : 'all')

/** The rule of the events that a person is invited to and has not answered: the ones to confirm. */
export const toConfirmRule = (person: { id: string; name: string }): Rule => ({
  ...newRule('people'),
  items: [{ value: person.id, label: person.name }],
  answer: 'needs-action',
})

/** The rule with another operator: what it said stays, as far as the new operator can use it. */
export function withOperator(rule: Rule, operator: string): Rule {
  const arity = arityOf(rule.field, operator)
  const items = arity === 'one' ? rule.items.slice(0, 1) : arity === 'many' ? rule.items : []
  return { ...rule, operator, items, text: arity === 'text' ? rule.text : '' }
}

const normalized = (text: string) => text.trim().toLowerCase()

/** Whether a rule says enough to be used: it has what its operator needs. */
function isComplete(rule: Rule) {
  const arity = arityOf(rule.field, rule.operator)
  if (arity === 'text') return normalized(rule.text) !== ''
  if (arity === 'one' || arity === 'many') return rule.items.length > 0
  return arity === 'none'
}

const isActive = (node: FilterNode): boolean =>
  node.kind === 'rule' ? isComplete(node) : node.children.some(isActive)

const countLeaves = (node: FilterNode): number =>
  node.kind === 'rule'
    ? Number(isComplete(node))
    : node.children.reduce((sum, child) => sum + countLeaves(child), 0)

/** How many rules are used: the leaves of the tree that are finished. */
export const countRules = (root: Group) => countLeaves(root)

/** Whether there is any rule that is used. */
export const hasRules = (root: Group) => isActive(root)

function textOf(event: CalendarEvent, field: 'title' | 'location' | 'notes') {
  if (field === 'title') return event.title
  if (field === 'notes') return event.description
  return event.locations.map(({ name }) => name).join(', ')
}

function matchesText(rule: Rule, event: CalendarEvent) {
  const value = normalized(textOf(event, rule.field as 'title' | 'location' | 'notes'))
  const wanted = normalized(rule.text)
  switch (rule.operator) {
    case 'contains':
      return value.includes(wanted)
    case 'notContains':
      return !value.includes(wanted)
    case 'is':
      return value === wanted
    case 'isNot':
      return value !== wanted
    case 'startsWith':
      return value.startsWith(wanted)
    case 'endsWith':
      return value.endsWith(wanted)
    case 'notEmpty':
      return value !== ''
    default:
      return value === ''
  }
}

function matchesList(rule: Rule, event: CalendarEvent) {
  const isPeople = rule.field === 'people'
  const present = isPeople ? event.participants : event.keywords
  const has = (wanted: string) =>
    isPeople
      ? event.participants.some(
          ({ id, status }) => id === wanted && (rule.answer === '' || status === rule.answer),
        )
      : event.keywords.some((keyword) => normalized(keyword) === normalized(wanted))
  const wanted = rule.items.map(({ value }) => value)
  switch (rule.operator) {
    case 'has':
      return wanted.some(has)
    case 'hasNot':
      return !wanted.some(has)
    case 'anyOf':
      return wanted.some(has)
    case 'allOf':
      return wanted.every(has)
    case 'noneOf':
      return !wanted.some(has)
    case 'notEmpty':
      return present.length > 0
    default:
      return present.length === 0
  }
}

function matchesStatus(rule: Rule, event: CalendarEvent) {
  const wanted = rule.items.map(({ value }) => value as EventStatus)
  const isIn = wanted.includes(event.status)
  return rule.operator === 'is' || rule.operator === 'in' ? isIn : !isIn
}

function matchesRule(rule: Rule, event: CalendarEvent) {
  if (rule.field === 'status') return matchesStatus(rule, event)
  if (rule.field === 'tags' || rule.field === 'people') return matchesList(rule, event)
  return matchesText(rule, event)
}

function matchesNode(node: FilterNode, event: CalendarEvent): boolean {
  if (node.kind === 'rule') return matchesRule(node, event)
  const results = node.children.filter(isActive).map((child) => matchesNode(child, event))
  switch (node.mode) {
    case 'all':
      return results.every(Boolean)
    case 'any':
      return results.some(Boolean)
    case 'none':
      return !results.some(Boolean)
    default:
      return !results.every(Boolean)
  }
}

/** Whether an event is shown by the rules. Without rules that are used, every event is. */
export const matches = (root: Group, event: CalendarEvent) =>
  !isActive(root) || matchesNode(root, event)

// ---- changes of the tree: they give a new one, and leave the old one as it was ----

function mapNode(
  node: FilterNode,
  id: string,
  change: (found: FilterNode) => FilterNode | null,
): FilterNode | null {
  if (node.id === id) return change(node)
  if (node.kind === 'rule') return node
  const children: FilterNode[] = node.children.flatMap((child) => {
    const next = mapNode(child, id, change)
    return next ? [next] : []
  })
  return { ...node, children }
}

/** The tree with the node that has this id changed. */
export const updateNode = <Node extends FilterNode>(
  root: Group,
  id: string,
  change: (found: Node) => Node,
) => mapNode(root, id, (found) => change(found as Node)) as Group

/** The tree without the node that has this id. */
export const removeNode = (root: Group, id: string) => mapNode(root, id, () => null) as Group

/** The tree with a node added at the end of a group. */
export const addNode = (root: Group, groupId: string, node: FilterNode) =>
  updateNode<Group>(root, groupId, (group) => ({ ...group, children: [...group.children, node] }))
