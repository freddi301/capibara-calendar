import type { CalendarEvent, EventStatus, ParticipationStatus } from '@/api/calendar-api'

export type FilterSubject = Pick<
  CalendarEvent,
  'title' | 'description' | 'locations' | 'keywords' | 'participants' | 'status'
>

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

export type Answer = '' | ParticipationStatus

export type Item = { value: string; label: string }

export type Rule = {
  id: string
  kind: 'rule'
  field: Field
  operator: string
  text: string
  items: Item[]
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

export const groupToAdd = (isInTheRoot: boolean): Group => newGroup(isInTheRoot ? 'any' : 'all')

export const toConfirmRule = (person: { id: string; name: string }): Rule => ({
  ...newRule('people'),
  items: [{ value: person.id, label: person.name }],
  answer: 'needs-action',
})

export function withOperator(rule: Rule, operator: string): Rule {
  const arity = arityOf(rule.field, operator)
  const items = arity === 'one' ? rule.items.slice(0, 1) : arity === 'many' ? rule.items : []
  return { ...rule, operator, items, text: arity === 'text' ? rule.text : '' }
}

const normalized = (text: string) => text.trim().toLowerCase()

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

export const countRules = (root: Group) => countLeaves(root)

export const hasRules = (root: Group) => isActive(root)

function textOf(event: FilterSubject, field: 'title' | 'location' | 'notes') {
  if (field === 'title') return event.title
  if (field === 'notes') return event.description
  return event.locations.map(({ name }) => name).join(', ')
}

function matchesText(rule: Rule, event: FilterSubject) {
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

function matchesList(rule: Rule, event: FilterSubject) {
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

function matchesStatus(rule: Rule, event: FilterSubject) {
  const wanted = rule.items.map(({ value }) => value as EventStatus)
  const isIn = wanted.includes(event.status)
  return rule.operator === 'is' || rule.operator === 'in' ? isIn : !isIn
}

function matchesRule(rule: Rule, event: FilterSubject) {
  if (rule.field === 'status') return matchesStatus(rule, event)
  if (rule.field === 'tags' || rule.field === 'people') return matchesList(rule, event)
  return matchesText(rule, event)
}

function matchesNode(node: FilterNode, event: FilterSubject): boolean {
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

export const matches = (root: Group, event: FilterSubject) =>
  !isActive(root) || matchesNode(root, event)

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

export const updateNode = <Node extends FilterNode>(
  root: Group,
  id: string,
  change: (found: Node) => Node,
) => mapNode(root, id, (found) => change(found as Node)) as Group

export const removeNode = (root: Group, id: string) => mapNode(root, id, () => null) as Group

export const addNode = (root: Group, groupId: string, node: FilterNode) =>
  updateNode<Group>(root, groupId, (group) => ({ ...group, children: [...group.children, node] }))
