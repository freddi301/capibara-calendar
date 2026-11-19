import { describe, expect, it } from 'vitest'
import { contactId, type Participant } from '@/api/calendar-api'
import { myParticipant } from '@/lib/event-actions'

const participants: Participant[] = [
  { id: contactId('mailto:ada@example.com'), status: 'accepted' },
  { id: contactId('mailto:Me@Example.com'), status: 'tentative' },
]

describe('me among the participants', () => {
  it('is the participant whose address is one of mine, whatever the case of the letters', () => {
    // when
    const me = myParticipant(participants, ['mailto:me@example.com'])

    // then
    expect(me?.status).toBe('tentative')
  })

  it('is nobody when none of my addresses is among them, or when I have no address', () => {
    // then
    expect(myParticipant(participants, ['mailto:eve@example.com'])).toBeUndefined()
    expect(myParticipant(participants, [])).toBeUndefined()
  })
})
