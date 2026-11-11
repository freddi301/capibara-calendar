import { zodResolver } from '@hookform/resolvers/zod'
import { Trans } from '@lingui/react/macro'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import Problem from '@/components/Problem'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { checkConnection, resetConnection } from '@/lib/caldav'
import {
  addressField,
  clearConnection,
  createConnectionSchema,
  loadConnection,
  saveConnection,
  type Connection,
} from '@/lib/connection'
import { connectionErrorMessage } from '@/lib/errors'
import { addressInput, passwordInput, usernameInput } from '@/lib/input-attributes'

const empty: Connection = { url: '', username: '', password: '' }

type ConnectionFormProps = {
  onConnectionChange: (connected: boolean) => void
}

export default function ConnectionForm({ onConnectionChange }: ConnectionFormProps) {
  const id = useId()
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(loadConnection)
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<Connection>({
    resolver: zodResolver(createConnectionSchema()),
    defaultValues: saved ?? empty,
  })
  const isConnected = saved !== undefined
  useEffect(() => {
    if (!isConnected) setFocus(addressField)
  }, [isConnected, setFocus])

  const connect = useMutation({
    mutationFn: async (values: Connection) => {
      await checkConnection(values)
      saveConnection(values)
      resetConnection()
      queryClient.clear()
      return values
    },
    onSuccess: (values) => {
      setSaved(values)
      onConnectionChange(true)
    },
  })

  const disconnect = () => {
    clearConnection()
    resetConnection()
    queryClient.clear()
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
      <FieldSet>
        <FieldLegend variant="label" className="mb-3 text-foreground/70">
          <Trans>Connection</Trans>
        </FieldLegend>
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
          <FieldDescription>
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
