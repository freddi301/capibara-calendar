import 'temporal-polyfill/global'
import { I18nProvider } from '@lingui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { i18n } from './i18n.ts'
import { createQueryClient } from './lib/query-client.ts'
import { applySettings, loadSettings, watchSystemTheme } from './lib/settings.ts'

const queryClient = createQueryClient()

watchSystemTheme()
await applySettings(loadSettings())

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </I18nProvider>
  </StrictMode>,
)
