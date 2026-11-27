import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { consumerProfiles, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam, type FakeDamAnswer } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import en from '@/locales/en'
import { commonT, i18n, setCommonAdminI18n } from '@/plugins/i18n'

// A file the DAM refuses with a reason names the reason in its row. The row showed only the
// generic "system error", also for a licence that does not allow a manual upload.

const QUEUE = 'refused-queue'

let dam: FakeDam
let waits: LongWaits

// The library's own instance has no messages in tests, so every text would be its key.
beforeAll(() => setCommonAdminI18n(createI18n({ legacy: false, locale: 'en', messages: { en } }) as never))
afterAll(() => setCommonAdminI18n(i18n as never))

afterEach(() => {
  useUploadQueuesStore().stopUpload(QUEUE)
  waits.restore()
  useDamNotificationsEventBus().reset()
})

const photo = () => new File([new Uint8Array(3000)], 'a.jpg', { type: 'image/jpeg' })
const forbidden = (detail: string): FakeDamAnswer => ({
  status: 422,
  data: { error: 'forbidden_operation_error', detail, contextId: 'context' },
})

describe.each(consumerProfiles)('a refused upload, under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile

  beforeEach(() => {
    setActivePinia(createPinia())
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    waits = holdLongWaits(10_000, { passFrom: 1_000 })
  })

  const failedRowAfter = async (route: RegExp, answer: FakeDamAnswer) => {
    dam.reply((request) => (route.test(request.url) ? answer : undefined))
    const store = useUploadQueuesStore()
    await store.addByFiles(QUEUE, extSystem, licence, [photo()], 'default')
    const [row] = store.getQueueItems(QUEUE)
    await vi.waitFor(() => expect(row!.status).toBe(UploadQueueItemStatus.Failed))
    return row!
  }

  it.each([
    ['licence_manual_upload_disabled', 'Manual upload is not allowed for this licence.'],
    ['asset_size_too_large', 'The file is too large.'],
    ['file_upload_too_many_files', 'The upload file count limit has been exceeded.'],
  ])('at the start, as a forbidden operation %s: the row names it', async (detail, text) => {
    const row = await failedRowAfter(dam.routes.start, forbidden(detail))

    expect(row.error).toMatchObject({ hasError: true, message: text })
  })

  it('as a forbidden operation without a text: the row says so, not "system error"', async () => {
    const row = await failedRowAfter(dam.routes.start, forbidden('something_new'))

    expect(row.error.message).toBe(commonT('error.apiForbiddenOperation.noTranslation'))
  })

  it('as invalid fields at the start: the row names the field', async () => {
    const row = await failedRowAfter(dam.routes.start, {
      status: 422,
      data: { error: 'validation_failed', fields: { mimeType: ['error_field_invalid'] } },
    })

    expect(row.error.message).toBe(commonT('common.damImage.uploadErrors.mimeType'))
  })

  it('for any other reason: the row keeps no text, and shows the generic error', async () => {
    const row = await failedRowAfter(dam.routes.start, { status: 503 })

    expect(row.error).toMatchObject({ hasError: true, message: '' })
  })
})
