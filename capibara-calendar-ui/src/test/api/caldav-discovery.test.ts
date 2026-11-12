import { describe, expect, it } from 'vitest'
import { discoverServerUrl } from '../../api/caldav/discovery'
import { parsePrivileges, rightsOf } from '../../api/caldav/privileges'

const answer = (status: number, location?: string) =>
  Promise.resolve(new Response(null, { status, headers: location ? { location } : {} }))

describe('the address of a server that was given by its host', () => {
  it('is the one that the server says at /.well-known/caldav, with the scheme that was written', async () => {
    const asked: string[] = []
    const found = await discoverServerUrl('https://drive.example.org/', (input) => {
      asked.push(typeof input === 'string' ? input : 'not a text')
      return answer(301, 'http://drive.example.org/remote.php/dav/')
    })

    expect(asked).toEqual(['https://drive.example.org/.well-known/caldav'])
    expect(found).toBe('https://drive.example.org/remote.php/dav/')
  })

  it('is the one that was written when it has a path, or when the server does not redirect', async () => {
    const never = () => Promise.reject(new Error('Not asked'))
    expect(await discoverServerUrl('https://drive.example.org/remote.php/dav', never)).toBe(
      'https://drive.example.org/remote.php/dav',
    )
    expect(await discoverServerUrl('https://drive.example.org/', () => answer(404))).toBe(
      'https://drive.example.org/',
    )
  })
})

describe('the rights on a calendar', () => {
  it('are made from the privileges of the server: write is all three, and the others are one each', () => {
    expect(rightsOf(['read', 'write'])).toEqual({ create: true, update: true, remove: true })
    expect(rightsOf(['read'])).toEqual({ create: false, update: false, remove: false })
    expect(rightsOf(['read', 'bind', 'write-content'])).toEqual({
      create: true,
      update: true,
      remove: false,
    })
  })

  it('are read from a multistatus answer, by the address of each calendar', () => {
    const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
      <d:response><d:href>/dav/mine/</d:href><d:propstat><d:prop><d:current-user-privilege-set>
        <d:privilege><d:read/></d:privilege><d:privilege><d:write/></d:privilege>
      </d:current-user-privilege-set></d:prop></d:propstat></d:response>
      <d:response><d:href>/dav/shared/</d:href><d:propstat><d:prop><d:current-user-privilege-set>
        <d:privilege><d:read/></d:privilege>
      </d:current-user-privilege-set></d:prop></d:propstat></d:response></d:multistatus>`
    const rights = parsePrivileges(xml, 'https://drive.example.org/dav/')

    expect(rights.get('https://drive.example.org/dav/mine/')?.update).toBe(true)
    expect(rights.get('https://drive.example.org/dav/shared/')).toEqual({
      create: false,
      update: false,
      remove: false,
    })
  })
})
