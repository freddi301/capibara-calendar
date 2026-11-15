import { describe, expect, it } from 'vitest'
import { contactId, type CalendarEvent } from '../api/calendar-api'
import {
  addNode,
  countRules,
  emptyFilter,
  matches,
  newGroup,
  newRule,
  removeNode,
  updateNode,
  withOperator,
  type Field,
  type Group,
  type GroupMode,
  type Item,
  type Rule,
} from '../lib/event-filter'
import { eventValues } from './api/contract'

const dentist = {
  ...eventValues({
    title: 'Dentist',
    description: 'Bring the forms',
    locations: [{ name: 'Café Lumen' }],
    keywords: ['Health', 'Work'],
    status: 'confirmed',
    participants: [
      { id: contactId('ada'), status: 'accepted' },
      { id: contactId('bruno'), status: 'needs-action' },
    ],
  }),
} as CalendarEvent

const bare = {
  ...eventValues({ title: 'Focus', status: 'tentative' }),
} as CalendarEvent

const item = (value: string): Item => ({ value, label: value })

function rule(
  field: Field,
  operator: string,
  what: { text?: string; items?: string[]; answer?: Rule['answer'] } = {},
): Rule {
  return {
    ...newRule(field),
    operator,
    text: what.text ?? '',
    items: (what.items ?? []).map(item),
    answer: what.answer ?? '',
  }
}

const filterOf = (mode: GroupMode, ...children: Group['children']): Group =>
  newGroup(mode, children)

describe('the rules of the filter', () => {
  it('shows every event when there are no rules, and when none of them is finished', () => {
    expect(matches(emptyFilter(), dentist)).toBe(true)
    // A "contains" with no word, and a group without rules, say nothing yet: nothing disappears.
    const unfinished = filterOf('all', rule('title', 'notContains'), newGroup('any'))
    expect(matches(unfinished, dentist)).toBe(true)
    expect(countRules(unfinished)).toBe(0)
  })

  it('compares the texts without caring for the case, in the ways that the operators say', () => {
    const title = (operator: string, text = '') =>
      matches(filterOf('all', rule('title', operator, { text })), dentist)
    expect(title('contains', 'DENT')).toBe(true)
    expect(title('notContains', 'dent')).toBe(false)
    expect(title('is', 'dentist')).toBe(true)
    expect(title('isNot', 'dentist')).toBe(false)
    expect(title('startsWith', 'den')).toBe(true)
    expect(title('endsWith', 'ist')).toBe(true)
    expect(title('notEmpty')).toBe(true)
    expect(title('empty')).toBe(false)
    expect(matches(filterOf('all', rule('location', 'is', { text: 'café lumen' })), dentist)).toBe(
      true,
    )
    expect(matches(filterOf('all', rule('notes', 'contains', { text: 'forms' })), dentist)).toBe(
      true,
    )
    expect(matches(filterOf('all', rule('location', 'empty')), bare)).toBe(true)
  })

  it('compares the tags, and the people with the answer that they gave', () => {
    const on = (...children: Rule[]) => matches(filterOf('all', ...children), dentist)
    expect(on(rule('tags', 'has', { items: ['health'] }))).toBe(true)
    expect(on(rule('tags', 'allOf', { items: ['Health', 'Play'] }))).toBe(false)
    expect(on(rule('tags', 'anyOf', { items: ['Health', 'Play'] }))).toBe(true)
    expect(on(rule('tags', 'noneOf', { items: ['Play'] }))).toBe(true)
    expect(on(rule('tags', 'empty'))).toBe(false)

    expect(on(rule('people', 'has', { items: ['ada'] }))).toBe(true)
    expect(on(rule('people', 'has', { items: ['ada'], answer: 'accepted' }))).toBe(true)
    expect(on(rule('people', 'has', { items: ['bruno'], answer: 'accepted' }))).toBe(false)
    expect(on(rule('people', 'has', { items: ['bruno'], answer: 'needs-action' }))).toBe(true)
    expect(on(rule('people', 'hasNot', { items: ['carla'] }))).toBe(true)
    expect(on(rule('people', 'notEmpty'))).toBe(true)
    expect(matches(filterOf('all', rule('people', 'empty')), bare)).toBe(true)
  })

  it('compares the status', () => {
    const status = (operator: string, ...items: string[]) =>
      matches(filterOf('all', rule('status', operator, { items })), dentist)
    expect(status('is', 'confirmed')).toBe(true)
    expect(status('isNot', 'cancelled')).toBe(true)
    expect(status('in', 'tentative', 'cancelled')).toBe(false)
    expect(status('notIn', 'tentative', 'cancelled')).toBe(true)
  })

  it('combines the rules of a group as all, at least one, none or not all of them', () => {
    const yes = rule('title', 'contains', { text: 'dent' })
    const no = rule('title', 'contains', { text: 'zzz' })
    const result = (mode: GroupMode) => matches(filterOf(mode, yes, no), dentist)
    expect([result('all'), result('any'), result('none'), result('notAll')]).toEqual([
      false,
      true,
      false,
      true,
    ])
  })

  it('goes into the groups that are inside other groups', () => {
    const nested = filterOf(
      'all',
      rule('tags', 'has', { items: ['Work'] }),
      filterOf(
        'any',
        rule('title', 'startsWith', { text: '1:1' }),
        rule('notes', 'contains', { text: 'forms' }),
      ),
    )
    expect(matches(nested, dentist)).toBe(true)
    expect(matches(nested, bare)).toBe(false)
    expect(countRules(nested)).toBe(3)
  })

  it('changes the operator and keeps what it can use', () => {
    const many = rule('tags', 'anyOf', { items: ['a', 'b'] })
    expect(withOperator(many, 'has').items).toEqual([item('a')])
    expect(withOperator(many, 'empty').items).toEqual([])
    expect(withOperator(rule('title', 'contains', { text: 'x' }), 'empty').text).toBe('')
  })

  it('gives a new tree when a node is added, changed or taken out, and leaves the old one as it was', () => {
    const first = rule('title', 'contains', { text: 'a' })
    const root = addNode(emptyFilter(), emptyFilter().id, first)
    expect(root.children).toEqual([]) // an id that is not there: nothing is added

    const base = filterOf('all', first)
    const changed = updateNode<Rule>(base, first.id, (found) => ({ ...found, text: 'b' }))
    expect((changed.children[0] as Rule).text).toBe('b')
    expect((base.children[0] as Rule).text).toBe('a')

    const added = addNode(base, base.id, rule('status', 'is', { items: ['confirmed'] }))
    expect(added.children).toHaveLength(2)
    expect(removeNode(added, first.id).children).toHaveLength(1)
    expect(base.children).toHaveLength(1)
  })
})
