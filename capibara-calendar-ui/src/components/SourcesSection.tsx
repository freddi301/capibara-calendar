import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'
import { hasSources, resetApi } from '@/api'
import type { SourceKind } from '@/api/calendar-api'
import ConnectionForm from '@/components/ConnectionForm'
import SourceCard, { AddSourceButton } from '@/components/SourceCard'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import WebcalForm from '@/components/WebcalForm'
import { connectionIds, newConnectionId, primaryConnectionId } from '@/lib/connection'
import { forgetPersistedQueries } from '@/lib/query-persist'
import { setStored, useStored } from '@/lib/use-stored'
import { nameOfFeed, removeWebcal } from '@/lib/webcal'
import { isWebxdc } from '@/lib/webxdc'

type SourcesSectionProps = {
  isRejected: boolean
  onConnectionChange: (connected: boolean) => void
  onDirtyChange: (id: string, isDirty: boolean) => void
}

type SwitchProps = {
  kind: Exclude<SourceKind, 'caldav' | 'webcal'>
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function SourceSwitch({ kind, label, description, checked, onChange }: SwitchProps) {
  return (
    <SourceCard
      kind={kind}
      title={label}
      description={description}
      control={<Switch aria-label={label} checked={checked} onCheckedChange={onChange} />}
    />
  )
}

export default function SourcesSection({
  isRejected,
  onConnectionChange,
  onDirtyChange,
}: SourcesSectionProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const state = useStored((stored) => stored.sources)
  const webcals = useStored((stored) => stored.webcals)
  const [saved, setSaved] = useState(connectionIds)
  const [added, setAdded] = useState<string[]>([])
  const forms = [primaryConnectionId, ...saved.filter((id) => id !== primaryConnectionId), ...added]

  const restart = () => {
    resetApi()
    queryClient.clear()
    void forgetPersistedQueries()
  }

  const turn = (kind: 'local' | 'memory') => (checked: boolean) => {
    setStored({ sources: { ...state, [kind]: checked } })
    restart()
    onConnectionChange(checked)
  }

  const changed = (connected: boolean) => {
    setSaved(connectionIds())
    setAdded((ids) => ids.filter((id) => !connectionIds().includes(id) || connected))
    onConnectionChange(connected)
  }

  const webcalsChanged = () => {
    restart()
    onConnectionChange(hasSources())
  }

  return (
    <section aria-labelledby="sources-title" className="flex flex-col gap-3">
      <h2 id="sources-title" className="text-lg font-semibold text-muted-foreground">
        <Trans>Sources</Trans>
      </h2>
      {isWebxdc() ? (
        <SourceCard
          kind="webxdc"
          title={t`Chat`}
          description={t`Shared with the people of this chat.`}
        />
      ) : (
        <>
          {forms.map((id) => (
            <ConnectionForm
              key={id}
              sourceId={id}
              isRejected={isRejected && id === primaryConnectionId}
              onConnectionChange={changed}
              onDirtyChange={onDirtyChange}
            />
          ))}
          <AddSourceButton
            onClick={() => {
              setAdded((ids) => [...ids, newConnectionId()])
            }}
          >
            <Trans>Add CalDAV</Trans>
          </AddSourceButton>
          {Object.entries(webcals).map(([id, { url, name }]) => (
            <SourceCard
              key={id}
              kind="webcal"
              title={nameOfFeed(url)}
              description={name}
              control={
                <Button
                  type="button"
                  variant="ghost"
                  className="size-11 text-muted-foreground"
                  aria-label={t`Remove ${name}`}
                  onClick={() => {
                    removeWebcal(id)
                    webcalsChanged()
                  }}
                >
                  <X />
                </Button>
              }
            />
          ))}
          <WebcalForm onChange={webcalsChanged} />
          <SourceSwitch
            kind="local"
            label={t`Local`}
            description={t`Kept in this browser.`}
            checked={state.local}
            onChange={turn('local')}
          />
          <SourceSwitch
            kind="memory"
            label={t`Memory`}
            description={t`Kept only while this page is open.`}
            checked={state.memory}
            onChange={turn('memory')}
          />
        </>
      )}
    </section>
  )
}
