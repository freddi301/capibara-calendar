import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { openCreateScreen } from '@/test/support/app'
import { chooseEnding, chooseRepeat, setUpRepeat } from '@/test/support/repeat'
import { seedStored } from '@/test/support/stored'

beforeEach(setUpRepeat)

it('has the rows of the repeat, once the event repeats: the select is the whole row until then', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  const labels = () =>
    screen.queryAllByText(/^(Every|Repeat on|Ends)$/).map((item) => item.textContent)
  expect(labels()).toEqual(['Ends']) // the end of the event itself
  expect(screen.getByRole('combobox', { name: 'Repeat' })).toHaveTextContent('Does not repeat')
  expect(screen.queryByLabelText('Repeat every')).not.toBeInTheDocument()

  // when
  await chooseRepeat('Day')

  // then
  expect(labels()).toEqual(['Ends', 'Every'])
  expect(screen.getByLabelText('Repeat every')).toHaveValue(1)
  expect(screen.getByRole('combobox', { name: 'Repeat' })).toHaveTextContent('Day')
  expect(screen.getByRole('combobox', { name: 'How the repeat ends' })).toHaveTextContent(
    'Does not end',
  )

  // when
  await chooseRepeat('Week')

  // then
  expect(labels()).toEqual(['Ends', 'Every', 'Repeat on'])

  // when
  await chooseRepeat('Year')

  // then
  await waitFor(() => {
    expect(labels()).toEqual(['Ends', 'Every']) // the days are for a week, gone when they went out
  })
})

it('says every so many days, weeks, months or years, in the singular and the plural', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  await chooseRepeat('Day')
  const unit = () => screen.getByRole('combobox', { name: 'Repeat' }).textContent.replace('▼', '')
  expect(unit()).toBe('Day')

  // when
  await userEvent.clear(screen.getByLabelText('Repeat every'))
  await userEvent.type(screen.getByLabelText('Repeat every'), '3')

  // then
  expect(unit()).toBe('Days')

  // when
  await chooseRepeat('Months') // for 3, the options are in the plural

  // then
  expect(unit()).toBe('Months')

  // when
  await userEvent.clear(screen.getByLabelText('Repeat every'))
  await userEvent.type(screen.getByLabelText('Repeat every'), '1')

  // then
  expect(unit()).toBe('Month')
})

it('keeps one day of the week at least: a repeat every week is on one', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  await chooseRepeat('Week')
  const days = () =>
    screen
      .getAllByRole('button', { pressed: true })
      .map((button) => button.querySelector('.sr-only')?.textContent)
  expect(days()).toHaveLength(1)
  const [only] = days()

  // when
  await userEvent.click(screen.getByRole('button', { name: only ?? '' }))

  // then
  expect(days()).toEqual([only])
})

it('starts the days of the week where the week starts', async () => {
  // given
  seedStored({ settings: { weekStart: 'sunday' } })
  renderApp(<App />)
  await openCreateScreen()

  // when
  await chooseRepeat('Week')

  // then
  const row = screen.getByRole('button', { name: 'Sunday' }).parentElement as HTMLElement
  expect(
    within(row)
      .getAllByRole('button')
      .map((button) => button.querySelector('.sr-only')?.textContent),
  ).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
})

it('has every way to repeat, and none of them for an event that is new', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()

  // when
  await userEvent.click(await screen.findByRole('combobox', { name: 'Repeat' }))

  // then
  const options = (await screen.findAllByRole('option')).map((option) => option.textContent)
  expect(options).toEqual(['Does not repeat', 'Day', 'Week', 'Month', 'Year'])
})

it('has the end of the repeat as three sentences: it does not end, ends on a day, ends after some times', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  await chooseRepeat('Month')

  // when
  await userEvent.click(screen.getByRole('combobox', { name: 'How the repeat ends' }))

  // then
  const options = (await screen.findAllByRole('option')).map((option) => option.textContent)
  expect(options).toEqual(['Does not end', 'Ends on', 'Ends after'])

  // when
  await userEvent.keyboard('{Escape}')

  // then
  await waitFor(() => {
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  // when
  await chooseEnding('Ends on')

  // then
  expect(screen.getByLabelText('Repeat until')).toBeInTheDocument()
  expect(screen.queryByLabelText('Repeat this many times')).not.toBeInTheDocument()

  // when
  await chooseEnding('Ends after')

  // then
  expect(screen.getByLabelText('Repeat this many times')).toBeInTheDocument()
  expect(screen.getByText('times')).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.queryByLabelText('Repeat until')).not.toBeInTheDocument() // it is gone when it went out
  })

  // when
  await chooseEnding('Does not end')

  // then
  await waitFor(() => {
    expect(screen.queryByLabelText('Repeat this many times')).not.toBeInTheDocument()
  })
})

it('has the units with a capital, in the list and in the row', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  await chooseRepeat('Week')
  await userEvent.clear(screen.getByLabelText('Repeat every'))
  await userEvent.type(screen.getByLabelText('Repeat every'), '4')

  // when
  await userEvent.click(screen.getByRole('combobox', { name: 'Repeat' }))

  // then
  const options = (await screen.findAllByRole('option')).map((option) => option.textContent)
  expect(options).toEqual(['Does not repeat', 'Days', 'Weeks', 'Months', 'Years']) // for 4: the plural

  // when
  await userEvent.click(screen.getByRole('option', { name: 'Weeks' }))

  // then
  expect(screen.getByRole('combobox', { name: 'Repeat' })).toHaveTextContent(/^Weeks/)
})
