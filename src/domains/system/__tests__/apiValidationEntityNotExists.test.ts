import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { useAlerts } from '@/domains/system/composables/alerts'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'
import { commonT, i18n, setCommonAdminI18n } from '@/plugins/i18n'

// common-bundle's `EntityExists` answers `entity_not_exists`, e.g. for a job with a keyword ID that does not exist.
// The code had no text, so the alert said only "Invalid." next to the field.

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

beforeAll(() => setCommonAdminI18n(createI18n({ legacy: false, locale: 'en', messages: { en } }) as never))
afterAll(() => setCommonAdminI18n(i18n as never))

describe('the API validation code entity_not_exists', () => {
  it('has a text in every language', () => {
    for (const messages of [sk, en, cs]) {
      expect(messages.error.apiValidation.entity_not_exists).toBeTruthy()
    }
  })

  it('reaches the alert instead of the "no translation" text', async () => {
    const { pushAlert } = await import('@/domains/system/composables/alertsQueue')
    const { showApiValidationError } = useAlerts()

    showApiValidationError([{ field: 'cms.job.model.srcKeywordId', errors: ['entity_not_exists'] }])

    const text = vi.mocked(pushAlert).mock.calls.at(-1)![1] as string
    expect(text).toContain('srcKeywordId: ' + commonT('error.apiValidation.entity_not_exists'))
    expect(text).not.toContain(commonT('error.apiValidation.noTranslation'))
  })
})
