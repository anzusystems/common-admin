import { describe, expect, it } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- this test is about the public entry itself
import { useCollabState } from '@/lib'
// eslint-disable-next-line no-restricted-imports -- as above
import type * as lib from '@/lib'

// The admins read four things from the collaboration state; the socket and the socket.io protocol
// behind it are the library's business.
describe('useCollabState', () => {
  it('gives an admin the reconnect flag, the room info, the field buffer and gatherBufferData', () => {
    expect(Object.keys(useCollabState()).sort()).toEqual([
      'collabFieldDataBufferState',
      'collabReconnecting',
      'collabRoomInfoState',
      'gatherBufferData',
    ])
    // @ts-expect-error -- the socket is internal
    expect(useCollabState().collabSocket).toBeUndefined()
  })

  it('keeps the socket.io protocol types out of the public entry', () => {
    // @ts-expect-error -- internal
    type Events = lib.CollabClientToServerEvents
    // @ts-expect-error -- internal
    type Callback = lib.CollabRoomInfoCallback
    const unused: [Events?, Callback?] = []
    expect(unused).toEqual([])
  })
})
