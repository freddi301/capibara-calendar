import { msg } from '@lingui/core/macro'
import type { Reminder } from './event-schema'

export const reminderLabels: Record<Exclude<Reminder, 'custom'>, ReturnType<typeof msg>> = {
  '': msg`No reminder`,
  '0': msg`At the start`,
  '5': msg`5 minutes before`,
  '10': msg`10 minutes before`,
  '15': msg`15 minutes before`,
  '30': msg`30 minutes before`,
  '60': msg`1 hour before`,
  '120': msg`2 hours before`,
  '1440': msg`1 day before`,
  '2880': msg`2 days before`,
  '10080': msg`1 week before`,
}

export const customReminderLabel = msg`Custom, kept as it is`
