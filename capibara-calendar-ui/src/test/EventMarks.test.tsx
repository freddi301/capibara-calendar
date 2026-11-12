import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import EventMarks from '../components/EventMarks'
import type { DisplayEvent } from '../lib/display-event'
import { displayOf } from './server'

const plain = displayOf({
  calendarUrl: '/c/',
  uid: '1',
  url: '/c/1.ics',
  ics: '',
  title: 'Standup',
  description: '',
  startDate: '2026-11-12',
  startTime: '',
  endDate: '',
  endTime: '',
})

const marks = (event: DisplayEvent) => {
  const { container } = render(<EventMarks event={event} />)
  return [...container.querySelectorAll('svg')].map((icon) =>
    [...icon.classList].find((name) => name.startsWith('lucide-') && name !== 'lucide'),
  )
}

it('has nothing for an event that has only a title', () => {
  const { container } = render(<EventMarks event={plain} />)
  expect(container).toBeEmptyDOMElement()
})

it('has a sign for each of: it repeats, a place, a call, a reminder, in this order', () => {
  expect(marks({ ...plain, isRecurring: true })).toEqual(['lucide-repeat'])
  expect(marks({ ...plain, location: 'Room 4' })).toEqual(['lucide-map-pin'])
  expect(marks({ ...plain, videoLink: 'https://meet.example.org/x' })).toEqual(['lucide-video'])
  expect(marks({ ...plain, hasAlerts: true })).toEqual(['lucide-bell'])
  expect(
    marks({
      ...plain,
      hasAlerts: true,
      videoLink: 'https://meet.example.org/x',
      location: 'Room 4',
      isRecurring: true,
    }),
  ).toEqual(['lucide-repeat', 'lucide-map-pin', 'lucide-video', 'lucide-bell'])
})

it('is not read out: the name of the event is its title and its times', () => {
  const { container } = render(<EventMarks event={{ ...plain, location: 'Room 4' }} />)
  expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
})
