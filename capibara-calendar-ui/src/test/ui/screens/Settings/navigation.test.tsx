import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import SettingsScreen from '@/screens/SettingsScreen'
import { renderApp } from '@/test/render'

function renderScreen({ withBack = true } = {}) {
  const onClose = vi.fn()
  renderApp(
    <SettingsScreen onClose={withBack ? onClose : undefined} onConnectionChange={vi.fn()} />,
  )
  return { onClose }
}

it('has the preferences and the sources, in this order', () => {
  // given
  renderScreen({ withBack: false })

  // then
  const headings = screen.getAllByText(/^(Settings|Preferences|Sources)$/)
  expect(headings.map((heading) => heading.textContent)).toEqual([
    'Settings',
    'Preferences',
    'Sources',
  ])
})

it('has a way back when there is a screen to go back to', async () => {
  // given
  const { onClose } = renderScreen()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  // then
  expect(onClose).toHaveBeenCalledOnce()
})

it('has no way back without it', () => {
  // given
  renderScreen({ withBack: false })

  // then
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
})
