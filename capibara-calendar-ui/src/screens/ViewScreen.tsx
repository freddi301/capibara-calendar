import { Trans, useLingui } from '@lingui/react/macro'
import BottomBar from '@/components/BottomBar'
import SheetBack, { SheetTitle } from '@/components/SheetBack'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { setStored, useStored } from '@/lib/use-stored'

type ViewScreenProps = { onClose: () => void }

export default function ViewScreen({ onClose }: ViewScreenProps) {
  const { t } = useLingui()
  const options = useStored((stored) => stored.viewOptions)
  const rows: { name: keyof typeof options; label: string }[] = [
    { name: 'calendar', label: t`Calendar name` },
    { name: 'tags', label: t`Tags` },
    { name: 'place', label: t`Place` },
    { name: 'participants', label: t`Participants` },
    { name: 'description', label: t`Description` },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
        <SheetTitle>
          <Trans>What to view</Trans>
        </SheetTitle>
        <div className="flex flex-col gap-2 phone:mt-auto">
          {rows.map(({ name, label }) => (
            <Label
              key={name}
              className="min-h-11 gap-3 rounded-md bg-muted/50 px-3 py-2.5 text-base font-semibold hover:bg-muted/70"
            >
              <Checkbox
                checked={options[name]}
                onCheckedChange={(checked) => {
                  setStored({ viewOptions: { ...options, [name]: checked } })
                }}
              />
              {label}
            </Label>
          ))}
        </div>
      </main>

      <BottomBar>
        <SheetBack onClick={onClose} title={<Trans>What to view</Trans>} />
      </BottomBar>
    </div>
  )
}
