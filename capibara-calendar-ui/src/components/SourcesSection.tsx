import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { resetApi } from '@/api'
import type { SourceKind } from '@/api/calendar-api'
import { loadSourcesState, saveSourcesState, type SourcesState } from '@/api/sources'
import ConnectionForm from '@/components/ConnectionForm'
import SourceIcon from '@/components/SourceIcon'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { connectionIds, newConnectionId, primaryConnectionId } from '@/lib/connection'
import { forgetPersistedQueries } from '@/lib/query-persist'
import { isWebxdc } from '@/lib/webxdc'

type SourcesSectionProps = {
  isRejected: boolean
  onConnectionChange: (connected: boolean) => void
  onDirtyChange: (id: string, isDirty: boolean) => void
}

type SwitchProps = {
  kind: Exclude<SourceKind, 'caldav'>
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function SourceSwitch({ kind, label, description, checked, onChange }: SwitchProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
      <SourceIcon kind={kind} className="size-5" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-foreground/70">{description}</span>
      </div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export default function SourcesSection({
  isRejected,
  onConnectionChange,
  onDirtyChange,
}: SourcesSectionProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const [state, setState] = useState<SourcesState>(loadSourcesState)
  const [saved, setSaved] = useState(connectionIds)
  const [added, setAdded] = useState<string[]>([])
  const forms = [primaryConnectionId, ...saved.filter((id) => id !== primaryConnectionId), ...added]

  const turn = (kind: 'local' | 'memory' | 'chat') => (checked: boolean) => {
    const next = { ...state, [kind]: checked }
    setState(next)
    saveSourcesState(next)
    resetApi()
    queryClient.clear()
    void forgetPersistedQueries()
    onConnectionChange(checked)
  }

  const changed = (connected: boolean) => {
    setSaved(connectionIds())
    setAdded((ids) => ids.filter((id) => !connectionIds().includes(id) || connected))
    onConnectionChange(connected)
  }

  return (
    <section aria-labelledby="sources-title" className="flex flex-col gap-3">
      <h2 id="sources-title" className="text-lg font-semibold text-muted-foreground">
        <Trans>Sources</Trans>
      </h2>
      {isWebxdc() ? (
        <SourceSwitch
          kind="webxdc"
          label={t`Chat`}
          description={t`Shared with the people of this chat.`}
          checked={state.chat}
          onChange={turn('chat')}
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
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-fit gap-1 px-2 text-muted-foreground"
            onClick={() => {
              setAdded((ids) => [...ids, newConnectionId()])
            }}
          >
            <Plus className="size-4" />
            <Trans>Add a CalDAV connection</Trans>
          </Button>
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
