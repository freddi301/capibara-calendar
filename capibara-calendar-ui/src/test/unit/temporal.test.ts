import { expect, it } from 'vitest'

it('has Temporal available, typed and at runtime', () => {
  const today = Temporal.PlainDate.from('2026-11-12')
  expect(today.add({ days: 1 }).toString()).toBe('2026-11-13')
  expect(Temporal.Now.plainDateISO().toString()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})
