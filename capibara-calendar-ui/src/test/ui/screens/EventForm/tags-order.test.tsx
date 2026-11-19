import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'
import TagsInput from '@/components/TagsInput'
import { renderApp } from '@/test/render'

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <TagsInput value={value} onChange={setValue} />
      <output>{value}</output>
    </>
  )
}

const stored = () => document.querySelector('output')?.textContent

it('has no handle to move a tag when there is only one', () => {
  // given
  renderApp(<Harness initial="Work" />)

  // then
  expect(screen.queryByRole('button', { name: /^Move/ })).not.toBeInTheDocument()
})

it('has a handle for every tag when there are two or more, named after the tag', () => {
  // given
  renderApp(<Harness initial="Work, family, trip" />)

  // then
  const group = screen.getByRole('group', { name: 'Tags' })
  for (const tag of ['Work', 'family', 'trip']) {
    expect(within(group).getByRole('button', { name: `Move ${tag}` })).toBeInTheDocument()
  }
})

it('keeps a tag where it is when it is picked up and dropped, or when moving it is cancelled', async () => {
  // given
  renderApp(<Harness initial="Work, family, trip" />)
  const handle = screen.getByRole('button', { name: 'Move Work' })

  // when
  handle.focus()
  await userEvent.keyboard(' ')
  await userEvent.keyboard('{Escape}')

  // then
  expect(stored()).toBe('Work, family, trip')
})
