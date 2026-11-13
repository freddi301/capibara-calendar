import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'
import { cn } from 'cn'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'

const Combobox = ComboboxPrimitive.Root
const ComboboxValue = ComboboxPrimitive.Value
const ComboboxGroup = ComboboxPrimitive.Group
const ComboboxCollection = ComboboxPrimitive.Collection

function ComboboxTrigger({ className, children, ...props }: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn(
        "flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-muted py-2 pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">{children}</span>
      <ComboboxPrimitive.Icon
        render={<ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />}
      />
    </ComboboxPrimitive.Trigger>
  )
}

function ComboboxContent({
  className,
  children,
  placeholder,
  ...props
}: ComboboxPrimitive.Popup.Props & { placeholder: string }) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner sideOffset={4} align="start" className="isolate z-50">
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            'relative isolate flex max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-56 origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        >
          <ComboboxPrimitive.Input
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-11 w-full shrink-0 border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground any-pointer-coarse:text-base"
          />
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxScroll({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn('min-h-0 flex-1 scroll-py-1 overflow-y-auto overscroll-contain', className)}
      {...props}
    />
  )
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn('px-3 py-3 text-sm text-muted-foreground empty:hidden', className)}
      {...props}
    />
  )
}

function ComboboxGroupLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn(
        'sticky top-0 z-10 border-y border-border bg-popover px-3 py-1 text-sm font-semibold text-muted-foreground first:border-t-0',
        className,
      )}
      {...props}
    />
  )
}

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        'relative flex min-h-11 w-full cursor-default items-center gap-1.5 py-1 pr-8 pl-3 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground',
        className,
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

export {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxItem,
  ComboboxScroll,
  ComboboxTrigger,
  ComboboxValue,
}
