import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { formatDate, formatTime } from '@/lib/format'
import { openPicker } from '@/lib/picker'

type PickerInputProps = ComponentProps<typeof Input> & {
  type: 'date' | 'time'
  value: string
}

export default function PickerInput({ className, type, value, ...props }: PickerInputProps) {
  const { i18n } = useLingui()
  const shown = !value
    ? ''
    : type === 'date'
      ? formatDate(value, i18n.locale)
      : formatTime(value, i18n.locale)
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className={cn('relative flex h-8 items-center', className)}>
      <Input
        type={type}
        className="peer absolute inset-0 z-10 h-full w-full opacity-0"
        onClick={openPicker}
        {...props}
      />
      <Input
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        aria-invalid={props['aria-invalid']}
        value={shown}
        className="h-8 min-w-0 px-1 text-center peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
      />
    </label>
  )
}
