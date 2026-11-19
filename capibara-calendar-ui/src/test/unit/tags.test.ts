import { expect, it } from 'vitest'
import { moveTag } from '@/lib/tags'

it('moves a tag to the place of another, and the ones between shift by one', () => {
  // given
  const tags = ['Work', 'family', 'trip', 'health']

  // then
  expect(moveTag(tags, 0, 2)).toEqual(['family', 'trip', 'Work', 'health'])
  expect(moveTag(tags, 3, 0)).toEqual(['health', 'Work', 'family', 'trip'])
  expect(tags).toEqual(['Work', 'family', 'trip', 'health']) // the list that was given is not changed
})

it('keeps the order when the tag does not move, or when a place does not exist', () => {
  // given
  const tags = ['Work', 'family']

  // then
  expect(moveTag(tags, 1, 1)).toEqual(['Work', 'family'])
  expect(moveTag(tags, -1, 0)).toEqual(['Work', 'family'])
  expect(moveTag(tags, 0, 5)).toEqual(['Work', 'family'])
})
