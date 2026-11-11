import { zodResolver } from '@hookform/resolvers/zod'
import { act, renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it } from 'vitest'
import { activateLocale } from '../i18n'
import { createEventSchema, type EventFormValues } from '../lib/event-schema'

function renderEventForm(defaultValues: EventFormValues) {
  return renderHook(() => {
    const form = useForm<EventFormValues>({
      resolver: zodResolver(createEventSchema()),
      defaultValues,
    })
    const { errors } = form.formState
    return { form, errors }
  })
}

afterEach(() => activateLocale('en'))

describe('event schema', () => {
  it('accepts a title and a calendar date', () => {
    const result = createEventSchema().safeParse({ title: ' Dentist ', date: '2026-11-12' })
    expect(result.success).toBe(true)
    expect(result.data?.title).toBe('Dentist')
  })

  it('reports errors per field through react-hook-form', async () => {
    const { result } = renderEventForm({ title: '   ', date: 'tomorrow' })

    await act(async () => {
      await result.current.form.trigger()
    })

    expect(result.current.errors.title?.message).toBe('Enter a title')
    expect(result.current.errors.date?.message).toBe('Enter a valid date')
  })

  it('reports errors in the active locale', async () => {
    await activateLocale('it')
    const { result } = renderEventForm({ title: '', date: '2026-11-12' })

    await act(async () => {
      await result.current.form.trigger()
    })

    expect(result.current.errors.title?.message).toBe('Inserisci un titolo')
  })
})
