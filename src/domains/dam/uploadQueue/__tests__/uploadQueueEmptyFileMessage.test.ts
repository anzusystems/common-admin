import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { consumerProfiles, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import sk from '@/locales/sk'
import { i18n, setCommonAdminI18n } from '@/plugins/i18n'

// The library refuses a file of no bytes before any request, and its row showed only
// "Systémová chyba. Skúste neskôr…", as if trying again could help. The row says the file is empty.

const QUEUE = 'empty-file-queue'

let dam: FakeDam
let waits: LongWaits

beforeAll(() => setCommonAdminI18n(createI18n({ legacy: false, locale: 'sk', messages: { sk } }) as never))
afterAll(() => setCommonAdminI18n(i18n as never))

afterEach(() => {
  useUploadQueuesStore().stopUpload(QUEUE)
  waits.restore()
  useDamNotificationsEventBus().reset()
})

describe.each(consumerProfiles)('an empty file, under the $name', (profile) => {
  beforeEach(() => {
    setActivePinia(createPinia())
    dam = createFakeDam(profile.endPoints)
    installConsumerProfile(profile, dam.client)
    waits = holdLongWaits(10_000, { passFrom: 1_000 })
  })

  it('fails its row with the reason, and asks the DAM nothing', async () => {
    const store = useUploadQueuesStore()
    await store.addByFiles(
      QUEUE,
      profile.extSystem,
      profile.licence,
      [new File([], 'prazdny.jpg', { type: 'image/jpeg' })],
      'default'
    )
    const [row] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(row!.status).toBe(UploadQueueItemStatus.Failed))

    expect(row!.error).toMatchObject({ hasError: true, message: 'Súbor je prázdny (0 B), nedá sa nahrať.' })
    expect(dam.requests).toEqual([])
  })
})
