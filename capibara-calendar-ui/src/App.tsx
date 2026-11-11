import { zodResolver } from '@hookform/resolvers/zod'
import { Trans } from '@lingui/react/macro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { createEvent, listEvents } from '@/lib/caldav'
import { createEventSchema, type EventFormValues } from '@/lib/event-schema'

export default function App() {
  const queryClient = useQueryClient()
  const events = useQuery({ queryKey: ['events'], queryFn: listEvents })
  const add = useMutation({
    mutationFn: createEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(createEventSchema()),
    defaultValues: { title: '', date: new Date().toLocaleDateString('en-CA') },
  })

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-4">
      <h1 className="text-2xl font-bold">Capibara Calendar</h1>

      <p className={events.isError ? 'text-destructive' : 'text-muted-foreground'}>
        {events.isError ? (
          <Trans>Cannot reach the CalDAV server</Trans>
        ) : events.isSuccess ? (
          <Trans>Connected to the CalDAV server</Trans>
        ) : null}
      </p>

      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) =>
          add.mutate(values, { onSuccess: () => reset({ ...values, title: '' }) }),
        )}
      >
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="title">
            <Trans>Title</Trans>
          </FieldLabel>
          <Input id="title" className="h-11" aria-invalid={!!errors.title} {...register('title')} />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field data-invalid={!!errors.date}>
          <FieldLabel htmlFor="date">
            <Trans>Date</Trans>
          </FieldLabel>
          <Input
            id="date"
            type="date"
            className="h-11"
            aria-invalid={!!errors.date}
            {...register('date')}
          />
          <FieldError errors={[errors.date]} />
        </Field>
        <Button type="submit" className="h-11" disabled={add.isPending}>
          <Trans>Add event</Trans>
        </Button>
        <FieldError>{add.error?.message}</FieldError>
      </form>

      <ul className="flex flex-col divide-y">
        {events.data?.map((event) => (
          <li key={event.uid} className="flex justify-between gap-4 py-3">
            <span className="font-medium">{event.title}</span>
            <time className="whitespace-nowrap text-muted-foreground">{event.date}</time>
          </li>
        ))}
        {events.isSuccess && !events.data.length && (
          <li className="py-3 text-muted-foreground">
            <Trans>No events yet</Trans>
          </li>
        )}
      </ul>
    </main>
  )
}
