import 'temporal-polyfill/global'
import { I18nProvider } from '@lingui/react'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { i18n } from './i18n.ts'
import { persistOptions } from './lib/query-persist.ts'
import { createQueryClient } from './lib/query-client.ts'
import { applySettings, loadSettings, watchSystemTheme } from './lib/settings.ts'

const queryClient = createQueryClient()

watchSystemTheme()
await applySettings(loadSettings())

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register('/sw.js')
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
        onSuccess={() => {
          void queryClient.invalidateQueries()
        }}
      >
        <App />
      </PersistQueryClientProvider>
    </I18nProvider>
  </StrictMode>,
)
