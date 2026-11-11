import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

/** Renders with the providers the app needs. Add new providers here. */
export function renderApp(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>)
}
