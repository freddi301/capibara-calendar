import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import EventMarks from '@/components/EventMarks'
import type { ParticipationStatus } from '@/api/calendar-api'
import { displayOf } from '@/test/server'

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

const tick = (mine?: ParticipationStatus, event = plain) => {
  const { container } = render(<EventMarks event={event} mine={mine} />)
  return container.querySelector('.lucide-check')
}

it('has a grey tick for an event that I was invited to and did not answer', () => {
  // when
  const mark = tick('needs-action')

  // then
  expect(mark).toHaveClass('text-muted-foreground')
})

it('has a green tick when I accepted, a yellow one when I said maybe, and a red one when I declined', () => {
  // then
  expect(tick('accepted')).toHaveClass('text-green-600')
  expect(tick('tentative')).toHaveClass('text-amber-600')
  expect(tick('declined')).toHaveClass('text-red-600')
})

it('has no tick when I am not one of the participants, and no marks at all for a plain event', () => {
  // when
  const { container } = render(<EventMarks event={plain} />)

  // then
  expect(container).toBeEmptyDOMElement()
})

it('has the tick before the other marks', () => {
  // given
  const recurring = displayOf({
    calendarUrl: '/c/',
    uid: '2',
    url: '/c/2.ics',
    ics: '',
    title: 'Weekly',
    description: '',
    startDate: '2026-11-12',
    startTime: '',
    endDate: '',
    endTime: '',
    location: 'Room 4',
    isRecurring: true,
  })

  // when
  const { container } = render(<EventMarks event={recurring} mine="accepted" />)

  // then
  const icons = [...container.querySelectorAll('svg')].map((icon) =>
    [...icon.classList].find((name) => name.startsWith('lucide-') && name !== 'lucide'),
  )
  expect(icons[0]).toBe('lucide-check')
  expect(icons).toHaveLength(3)
})

it('draws the background of only the top half of each mark', () => {
  // when
  const { container } = render(<EventMarks event={plain} mine="accepted" />)

  // then: the half circle that cuts the event out, and the gradient that stops in the middle
  const half = container.querySelector('[class*="clip-path"]')
  expect(half).not.toBeNull()
  expect(container.innerHTML).toContain('linear-gradient(to_bottom')
})
