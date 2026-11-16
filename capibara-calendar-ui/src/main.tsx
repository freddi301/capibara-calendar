import 'temporal-polyfill/global'
import { I18nProvider } from '@lingui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from './components/ui/sonner.tsx'
import { i18n } from './i18n.ts'
import { persistOptions } from './lib/query-persist.ts'
import { createQueryClient } from './lib/query-client.ts'
import { isWebxdc } from './lib/webxdc.ts'
import { applySettings, loadSettings, watchSystemTheme } from './lib/settings.ts'

const queryClient = createQueryClient()

const seeded = import.meta.env.DEV
  ? await import('./dev/seed.ts').then(({ seedFromUrl }) => seedFromUrl())
  : undefined

watchSystemTheme()
await applySettings({ ...loadSettings(), ...seeded })

if ('serviceWorker' in navigator && import.meta.env.PROD && !isWebxdc()) {
  void navigator.serviceWorker.register('/sw.js')
}

const app = (
  <>
    <App />
    <Toaster />
  </>
)

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      {seeded ? (
        <QueryClientProvider client={queryClient}>{app}</QueryClientProvider>
      ) : (
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
          onSuccess={() => {
            void queryClient.invalidateQueries()
          }}
        >
          {app}
        </PersistQueryClientProvider>
      )}
    </I18nProvider>
  </StrictMode>,
)
