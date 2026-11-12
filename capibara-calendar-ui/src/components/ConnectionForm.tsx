import { zodResolver } from '@hookform/resolvers/zod'
import { Trans } from '@lingui/react/macro'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import Problem from '@/components/Problem'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { resetApi } from '@/api'
import { checkCaldav } from '@/api/sources'
import {
  firstField,
  loadAddressOf,
  primaryConnectionId,
  passwordField,
  presetUrl,
  clearConnectionOf,
  createConnectionSchema,
  loadConnectionOf,
  saveConnectionOf,
  type Connection,
} from '@/lib/connection'
import { connectionErrorMessage } from '@/lib/errors'
import { forgetPersistedQueries } from '@/lib/query-persist'
import { addressInput, passwordInput, usernameInput } from '@/lib/input-attributes'

const empty: Connection = { url: presetUrl, username: '', password: '' }

type ConnectionFormProps = {
  sourceId?: string
  isRejected?: boolean
  onConnectionChange: (connected: boolean) => void
  onDirtyChange: (id: string, isDirty: boolean) => void
}

export default function ConnectionForm({
  sourceId = primaryConnectionId,
  isRejected = false,
  onConnectionChange,
  onDirtyChange,
}: ConnectionFormProps) {
  const id = useId()
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(() => loadConnectionOf(sourceId))
  const [address] = useState(() => loadAddressOf(sourceId))
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<Connection>({
    resolver: zodResolver(createConnectionSchema()),
    defaultValues: saved ?? { ...empty, ...address },
  })
  const isConnected = saved !== undefined
  useEffect(() => {
    onDirtyChange(sourceId, isDirty)
  }, [isDirty, onDirtyChange, sourceId])
  useEffect(() => {
    if (!isConnected) setFocus(address ? passwordField : firstField)
  }, [isConnected, address, setFocus])

  const connect = useMutation({
    meta: { isTrial: true },
    mutationFn: async (values: Connection) => {
      await checkCaldav(values, sourceId)
      saveConnectionOf(sourceId, values)
      resetApi()
      queryClient.clear()
      void forgetPersistedQueries()
      return values
    },
    onSuccess: (values) => {
      setSaved(values)
      reset(values)
      onConnectionChange(true)
    },
  })

  const disconnect = () => {
    clearConnectionOf(sourceId)
    resetApi()
    queryClient.clear()
    void forgetPersistedQueries()
    connect.reset()
    reset(empty)
    setSaved(undefined)
    onConnectionChange(false)
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          connect.mutate(values)
        })(event)
      }}
    >
      {!isConnected && address && (
        <p
          role={isRejected ? 'alert' : 'status'}
          className={isRejected ? 'text-sm text-destructive' : 'text-sm text-foreground/70'}
        >
          {isRejected ? (
            <Trans>The server did not accept the password. Enter it again.</Trans>
          ) : (
            <Trans>Enter your password to connect again.</Trans>
          )}
        </p>
      )}
      <FieldSet>
        <Field>
          <FieldLabel htmlFor={`${id}-url`}>
            <Trans>Server address</Trans>
          </FieldLabel>
          <Input
            id={`${id}-url`}
            {...addressInput}
            aria-invalid={!!errors.url}
            {...register('url')}
          />
          <FieldDescription className="text-foreground/70">
            <Trans>For Nextcloud, the address ends with /remote.php/dav</Trans>
          </FieldDescription>
          <FieldError errors={[errors.url]} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-username`}>
            <Trans>Username</Trans>
          </FieldLabel>
          <Input id={`${id}-username`} {...usernameInput} {...register('username')} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-password`}>
            <Trans>Password</Trans>
          </FieldLabel>
          <Input id={`${id}-password`} {...passwordInput} {...register('password')} />
        </Field>
      </FieldSet>

      {connect.isError && <Problem message={connectionErrorMessage(connect.error)} />}
      {connect.isSuccess && (
        <p role="status" className="text-sm text-muted-foreground">
          <Trans>Connected to the CalDAV server</Trans>
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" className="h-9 flex-1" disabled={connect.isPending}>
          {connect.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          <Trans>Connect</Trans>
        </Button>
        {isConnected && (
          <Button
            type="button"
            variant="outline"
            className="h-9 flex-1"
            disabled={connect.isPending}
            onClick={disconnect}
          >
            <Trans>Disconnect</Trans>
          </Button>
        )}
      </div>
    </form>
  )
}
