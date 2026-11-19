import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'
import TagsInput from '../components/TagsInput'
import { renderApp } from './render'

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <TagsInput value={value} onChange={setValue} />
      <output>{value}</output>
    </>
  )
}

const stored = () => document.querySelector('output')?.textContent
const chips = () => screen.getByRole('group', { name: 'Tags' })

it('shows the tags that there are as chips, and a text to add another', () => {
  renderApp(<Harness initial="Work, family" />)

  expect(chips()).toHaveTextContent('Work')
  expect(chips()).toHaveTextContent('family')
  expect(screen.getByRole('button', { name: 'Remove Work' })).toBeInTheDocument()
  expect(screen.getByLabelText('New tag')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Add tag' })).toBeInTheDocument()
})

it('adds a tag with Enter, with a comma, and with the plus', async () => {
  renderApp(<Harness />)
  const input = screen.getByLabelText('New tag')

  await userEvent.type(input, 'Work{Enter}')
  await userEvent.type(input, 'family,')
  await userEvent.type(input, 'trip')
  await userEvent.click(screen.getByRole('button', { name: 'Add tag' }))

  expect(stored()).toBe('Work, family, trip')
  expect(input).toHaveValue('')
})

it('adds what is typed when the text is left, so that it is not lost on save', async () => {
  renderApp(<Harness />)

  await userEvent.type(screen.getByLabelText('New tag'), 'Health')
  await userEvent.tab()

  expect(stored()).toBe('Health')
})

it('does not add a tag twice, nor an empty one', async () => {
  renderApp(<Harness initial="Work" />)
  const input = screen.getByLabelText('New tag')

  await userEvent.type(input, 'work{Enter}')
  await userEvent.type(input, '  {Enter}')
  await userEvent.click(screen.getByRole('button', { name: 'Add tag' }))

  expect(stored()).toBe('Work')
})

it('takes a tag away with its x, and the last one with Backspace in the empty text', async () => {
  renderApp(<Harness initial="Work, family, trip" />)

  await userEvent.click(screen.getByRole('button', { name: 'Remove family' }))
  expect(stored()).toBe('Work, trip')

  await userEvent.click(screen.getByLabelText('New tag'))
  await userEvent.keyboard('{Backspace}')
  expect(stored()).toBe('Work')
})
