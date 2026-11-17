import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { activateLocale } from '@/i18n'
import { zoneName } from '@/lib/zone-choice'
import { matchMediaMock } from '@/test/mocks/match-media'
import { renderApp } from '@/test/render'
import { choose, openSettings, setUpApp } from '@/test/support/app'
import { seedStored, storedJson } from '@/test/support/stored'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkCaldav: vi.fn(),
}))
vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  resetApi: vi.fn(),
}))

beforeEach(setUpApp)

afterEach(() => {
  vi.useRealTimers()
})

it('opens the settings page from the bottom bar and goes back', async () => {
  // given
  renderApp(<App />)

  // when
  await openSettings()

  // then
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  // Language and theme both follow the system by default.
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveTextContent('System')
  expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveTextContent('System')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  // then
  expect(await screen.findByText('Dentist')).toBeInTheDocument()
})

it('switches the language and remembers it', async () => {
  // given
  renderApp(<App />)
  await openSettings()

  // when
  await choose('Language', 'Italiano')

  // then
  expect(await screen.findByRole('heading', { name: 'Impostazioni' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Lingua' })).toHaveTextContent('Italiano')
  expect(storedJson().settings).toEqual({ language: 'it' })

  // when: back to the system language, the choice is forgotten
  await choose('Lingua', /^Sistema/)

  // then
  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  expect(storedJson().settings).toEqual({})
})

it('switches the theme and remembers it', async () => {
  // given
  renderApp(<App />)
  await openSettings()

  // when
  await choose('Theme', 'Dark')

  // then
  expect(document.documentElement).toHaveClass('dark')
  expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveTextContent('Dark')
  expect(storedJson().settings).toEqual({ theme: 'dark' })

  // when
  await choose('Theme', 'Light')

  // then
  expect(document.documentElement).not.toHaveClass('dark')
})

it('shows the choices that were saved earlier', async () => {
  // given
  seedStored({ settings: { theme: 'light' } })
  renderApp(<App />)

  // when
  await openSettings()

  // then
  expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveTextContent('Light')
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveTextContent('System')
})

it('follows the system time zone and first day of the week by default', async () => {
  // given
  renderApp(<App />)

  // when
  await openSettings()

  // then
  expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveTextContent(/^System /)
  expect(screen.getByRole('combobox', { name: 'First day of the week' })).toHaveTextContent(
    'System',
  )
})

it('chooses the time zone and the first day of the week, and remembers them', async () => {
  // given
  renderApp(<App />)
  await openSettings()

  // when
  await choose('Time zone', 'Kiritimati')
  await choose('First day of the week', 'Saturday')

  // then
  expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveTextContent('Kiritimati')
  expect(screen.getByRole('combobox', { name: 'First day of the week' })).toHaveTextContent(
    'Saturday',
  )
  expect(storedJson().settings).toEqual({ timeZone: 'Pacific/Kiritimati', weekStart: 'saturday' })

  // when: back to the system
  await choose('Time zone', /^System/)
  await choose('First day of the week', /^System/)

  // then: nothing is stored any more
  expect(storedJson().settings).toEqual({})
}, 15_000)

it('shows what the system is after each System option', async () => {
  // given
  renderApp(<App />)

  // when
  await openSettings()

  // then
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveTextContent('System English')
  expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveTextContent('System Light')
  expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveTextContent(
    `System ${zoneName(Temporal.Now.timeZoneId())}`,
  )
  expect(screen.getByRole('combobox', { name: 'First day of the week' })).toHaveTextContent(
    'System Sunday', // the region of the browser is en-US
  )
})

it('shows a dark system theme, and the system language of the browser, in Italian', async () => {
  // given
  const lightSystem = matchMediaMock.getMockImplementation()
  matchMediaMock.mockReturnValue({
    matches: true, // the operating system is dark
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as ReturnType<typeof matchMediaMock>)
  const languages = vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['it-IT'])
  const language = vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('it-IT')
  try {
    await activateLocale('it')
    renderApp(<App />)

    // when
    await userEvent.click(await screen.findByRole('button', { name: 'Impostazioni' }))

    // then
    expect(screen.getByRole('combobox', { name: 'Lingua' })).toHaveTextContent('Sistema Italiano')
    expect(screen.getByRole('combobox', { name: 'Tema' })).toHaveTextContent('Sistema Scuro')
    expect(
      screen.getByRole('combobox', { name: 'Primo giorno della settimana' }),
    ).toHaveTextContent('Sistema Lunedì')
  } finally {
    if (lightSystem) matchMediaMock.mockImplementation(lightSystem)
    languages.mockRestore() // the browser is English again for the tests after this one
    language.mockRestore()
  }
})

it('shows what the system is as secondary text next to System, not in parentheses', async () => {
  // given
  renderApp(<App />)

  // when
  await openSettings()

  // then
  const language = screen.getByRole('combobox', { name: 'Language' })
  expect(within(language).getByText('English')).toHaveClass('text-muted-foreground')
  expect(language).not.toHaveTextContent('(')
  expect(within(screen.getByRole('combobox', { name: 'Theme' })).getByText('Light')).toHaveClass(
    'text-muted-foreground',
  )
})
