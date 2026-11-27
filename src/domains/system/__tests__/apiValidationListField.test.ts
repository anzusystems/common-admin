import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { useAlerts } from '@/domains/system/composables/alerts'
import en from '@/locales/en'
import { i18n, setCommonAdminI18n } from '@/plugins/i18n'

// A field of a list item, as `exportData[2].exportType`. Its label was looked up under the list's name minus its last
// letter, admin-cms's `items` → `item.name`. admin-dam's `exportData` became `exportDat`, and the alert showed the raw
// key "coreDam.podcast.model.exportDat.exportType" (#87746).

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

const messages = {
  ...en,
  coreDam: {
    podcast: { model: { exportData: 'Export data' } },
    podcastExportData: { model: { exportType: 'Export type' } },
  },
  cms: {
    image: { model: { title: 'Image title' } },
    promoLink: { model: { items: 'Words', item: { name: 'Alternative word' } } },
    linkedList: { model: { entries: { title: 'Entry title' } } },
  },
}

beforeAll(() => setCommonAdminI18n(createI18n({ legacy: false, locale: 'en', messages: { en: messages } }) as never))
afterAll(() => setCommonAdminI18n(i18n as never))

const alertFor = async (field: string) => {
  const { pushAlert } = await import('@/domains/system/composables/alertsQueue')
  useAlerts().showApiValidationError([{ field, errors: ['error_field_not_unique'] }])
  return vi.mocked(pushAlert).mock.calls.at(-1)![1] as string
}

describe('the API validation alert for a field of a list item', () => {
  it('names a field kept in an entity of its own, as admin-dam names the podcast export data', async () => {
    const text = await alertFor('coreDam.podcast.model.exportData[2].exportType')

    expect(text).toContain('Export data[2]: Export type: Field must be unique.')
    expect(text).not.toContain('coreDam.')
  })

  it('names a field kept under the list name without its final "s", as admin-cms names its promo links', async () => {
    const text = await alertFor('cms.promoLink.model.items[0].name')

    expect(text).toContain('Words[0]: Alternative word: Field must be unique.')
  })

  it('names a field kept under the list name itself', async () => {
    const text = await alertFor('cms.linkedList.model.entries[1].title')

    expect(text).toContain('entries[1]: Entry title: Field must be unique.')
    expect(text).not.toContain('cms.')
  })

  // A body that is a list itself names `[0].title`, so the field is `cms.image.model.[0].title`.
  it('names a field of an item of a list sent as the whole body by the label of the entity', async () => {
    const text = await alertFor('cms.image.model.[0].title')

    expect(text).toContain('[0]: Image title: Field must be unique.')
  })

  it('shows the bare names, as for a field outside a list, when nothing translates them', async () => {
    const text = await alertFor('coreDam.podcast.model.chapters[3].start')

    expect(text).toContain('chapters[3]: start: Field must be unique.')
    expect(text).not.toContain('coreDam.')
  })

  it('names the item alone when the error is on the item itself', async () => {
    const text = await alertFor('coreDam.podcast.model.exportData[1]')

    expect(text).toContain('Export data[1]: Field must be unique.')
  })
})
