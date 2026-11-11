import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from '../App'
import { renderApp } from './render'

it('renders the app title and tagline', () => {
  renderApp(<App />)
  expect(screen.getByRole('heading', { name: 'Capibara Calendar' })).toBeInTheDocument()
  expect(screen.getByText('Your calendars, in one place')).toBeInTheDocument()
})
