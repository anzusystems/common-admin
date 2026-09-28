import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/vue'
import type { ErrorEvent } from '@sentry/vue'
import { initCommonAdminCollabOptions } from '@/plugins/pluginOptions'
import { useCollabInit } from '@/components/collab/composables/collabInit'
import { useCollabStateInternal } from '@/components/collab/composables/collabState'

// The report is what reaches Sentry, not what logError was called with: captureException reads a
// context object with `level`/`tags` as scope data and keeps only the scope keys of it.
const events: ErrorEvent[] = []
beforeAll(() => {
  Sentry.init({
    dsn: 'https://public@o0.ingest.sentry.io/0',
    defaultIntegrations: false,
    integrations: [],
    beforeSend: (event) => {
      events.push(event)
      return null
    },
  })
})
afterAll(async () => {
  await Sentry.close()
})

describe('initCollab failure report', () => {
  it('tells which phase failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    initCommonAdminCollabOptions({
      enabled: true,
      socketUrl: 'wss://collab.example',
      beforeReconnect: async () => {},
      io: () => {
        throw new Error('boom')
      },
    } as never)
    useCollabStateInternal().collabSocket.value = undefined

    useCollabInit().initCollab()

    await vi.waitFor(() => expect(events).toHaveLength(1))
    const [event] = events
    expect(event!.exception?.values?.[0]?.value).toBe('boom')
    expect(event!.level).toBe('error')
    expect(event!.tags).toMatchObject({ collabPhase: 'init' })
  })
})
