import { zodResolver } from '@hookform/resolvers/zod'
import { act, renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it } from 'vitest'
import { activateLocale } from '../i18n'
import { createEventSchema, eventKind, type EventFormValues } from '../lib/event-schema'

const valid: EventFormValues = {
  calendarUrl: '/personal/',
  title: 'Dentist',
  description: '',
  startDate: '2026-11-12',
  startTime: '',
  endDate: '',
  endTime: '',
}

function errorsFor(values: Partial<EventFormValues>) {
  const result = createEventSchema().safeParse({ ...valid, ...values })
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]))
}

afterEach(() => activateLocale('en'))

describe('event kind', () => {
  it('is inferred from what is filled in', () => {
    expect(eventKind(valid)).toBe('allDay')
    expect(eventKind({ ...valid, startTime: '09:30' })).toBe('start')
    expect(eventKind({ ...valid, startTime: '09:30', endTime: '10:30' })).toBe('startEnd')
  })
})

describe('event schema', () => {
  it('accepts the three kinds of event and trims the title', () => {
    expect(createEventSchema().safeParse({ ...valid, title: ' Dentist ' }).data?.title).toBe(
      'Dentist',
    )
    expect(errorsFor({ endDate: '2026-11-14' })).toEqual({})
    expect(errorsFor({ startTime: '09:30' })).toEqual({})
    expect(errorsFor({ startTime: '09:30', endTime: '10:30' })).toEqual({})
    expect(errorsFor({ startTime: '22:00', endDate: '2026-11-13', endTime: '01:00' })).toEqual({})
  })

  it('turns line breaks in the title into spaces', () => {
    const title = (value: string) =>
      createEventSchema().safeParse({ ...valid, title: value }).data?.title
    expect(title('Dentist\nappointment')).toBe('Dentist appointment')
    expect(title('  Dentist \r\n  appointment  ')).toBe('Dentist appointment')
    expect(title('\n\n')).toBeUndefined() // nothing is left, so the title is missing
  })

  it('needs a calendar, a title and a valid start date', () => {
    expect(errorsFor({ calendarUrl: '' }).calendarUrl).toBe('Choose a calendar')
    expect(errorsFor({ title: '   ' }).title).toBe('Enter a title')
    expect(errorsFor({ startDate: 'tomorrow' }).startDate).toBe('Enter a valid date')
  })

  it('flags an end before the start on the field that is too early', () => {
    expect(errorsFor({ endDate: '2026-11-11' }).endDate).toBe('The end cannot be before the start')
    expect(errorsFor({ startTime: '10:00', endTime: '09:00' }).endTime).toBe(
      'The end cannot be before the start',
    )
  })

  it('needs the times to go together', () => {
    expect(errorsFor({ endTime: '10:00' }).startTime).toBe('Enter a start time')
    expect(errorsFor({ startTime: '09:00', endDate: '2026-11-13' }).endTime).toBe(
      'Enter an end time',
    )
  })

  it('works with react-hook-form and reports errors in the active locale', async () => {
    await activateLocale('it')
    const { result } = renderHook(() => {
      const form = useForm<EventFormValues>({
        resolver: zodResolver(createEventSchema()),
        defaultValues: { ...valid, title: '', endDate: '2026-11-10' },
      })
      const { errors } = form.formState
      return { form, errors }
    })

    await act(async () => {
      await result.current.form.trigger()
    })

    expect(result.current.errors.title?.message).toBe('Inserisci un titolo')
    expect(result.current.errors.endDate?.message).toBe("La fine non può precedere l'inizio")
  })
})
