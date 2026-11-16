import { useLingui } from '@lingui/react/macro'
import { useSyncExternalStore } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

function watchTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => {
    observer.disconnect()
  }
}

const isDark = () => document.documentElement.classList.contains('dark')

const Toaster = ({ ...props }: ToasterProps) => {
  const { t } = useLingui()
  const theme = useSyncExternalStore(watchTheme, isDark, () => false) ? 'dark' : 'light'

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      closeButton
      mobileOffset={{ bottom: '3.5rem', left: 16, right: 16 }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: t`Close`,
        classNames: {
          toast:
            'cn-toast grid! grid-cols-[minmax(0,1fr)_auto]! items-start! gap-x-3! gap-y-0! py-1.5! pr-2! pl-3! text-sm!',
          icon: 'hidden!',
          content: 'col-start-1 row-start-1 row-span-2 self-stretch!',
          title: 'flex! flex-1 flex-col! justify-between!',
          description: 'text-sm! leading-snug',
          closeButton:
            'static! col-start-2 row-start-1 size-8! translate-none! transform-none! justify-self-end border-0! bg-transparent! text-foreground opacity-100! hover:bg-muted! [&>svg]:size-5!',
          actionButton: 'col-start-2 row-start-2 ml-0! h-8! justify-self-end text-sm!',
          cancelButton: 'h-8! text-sm!',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
