import { Trans, useLingui } from '@lingui/react/macro'
import { ChevronDown } from 'lucide-react'
import BottomBar from '@/components/BottomBar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { saveViewOptions, useViewOptions, type ViewOptions } from '@/lib/view-options'

type ViewScreenProps = { onClose: () => void }

export default function ViewScreen({ onClose }: ViewScreenProps) {
  const { t } = useLingui()
  const options = useViewOptions()
  const rows: { name: keyof ViewOptions; label: string }[] = [
    { name: 'tags', label: t`Tags` },
    { name: 'place', label: t`Place` },
    { name: 'description', label: t`Description` },
  ]

  return (
    <>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pb-16">
        <h1 className="text-2xl font-bold text-muted-foreground">
          <Trans>What to view</Trans>
        </h1>
        <div className="mt-auto flex flex-col gap-2">
          {rows.map(({ name, label }) => (
            <Label
              key={name}
              className="min-h-11 gap-3 rounded-md bg-muted/50 px-3 py-2.5 text-base font-semibold hover:bg-muted/70"
            >
              <Checkbox
                checked={options[name]}
                onCheckedChange={(checked) => {
                  saveViewOptions({ ...options, [name]: checked })
                }}
              />
              {label}
            </Label>
          ))}
        </div>
      </main>

      <BottomBar>
        <Button
          variant="ghost"
          className="h-11 w-full text-muted-foreground"
          aria-label={t`Back`}
          onClick={onClose}
        >
          <ChevronDown className="size-6" />
        </Button>
      </BottomBar>
    </>
  )
}
