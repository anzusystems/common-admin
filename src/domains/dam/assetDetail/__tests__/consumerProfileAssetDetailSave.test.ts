import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { consumerProfiles, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamAnswer,
} from '@/domains/dam/__tests__/support/fakeDam'
import { alertText, forgetAlerts, shownAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import AssetDetailSidebarActionsTeleportTarget from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsTeleportTarget.vue'
import AssetDetailSidebarMetadata from '@/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'

// The save of the detail of one asset, under each of the two applications: what it says when the DAM refuses it.
// The real sidebar of the metadata with its real form over the real store of the detail, its buttons in their real
// place; the DAM is a client that records its requests. Not mounted for real: the inputs that ask the DAM for names
// to offer, and the chips of the users who made and changed the asset.

const QUEUE = 'asset-detail'

let pinia: Pinia
let dam: FakeDam
let wrapper: VueWrapper | undefined

describe.each(consumerProfiles)('the save of the detail of an asset under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    forgetAlerts()
    setApiErrorLogger(null)
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    setApiErrorLogger(defaultApiErrorLogger)
  })

  /** The detail of an asset is open, as a widget opens it. */
  const openDetail = async () => {
    useAssetDetailStore(pinia).setAsset(
      damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, {
        licence,
        metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )
    const Detail = defineComponent({
      setup: () => () =>
        h('div', [
          h(AssetDetailSidebarMetadata, {
            queueKey: QUEUE,
            isActive: true,
            assetType: DamAssetType.Image,
            extSystem,
          }),
          h(AssetDetailSidebarActionsTeleportTarget, { queueKey: QUEUE }),
        ]),
    })
    wrapper = mount(Detail, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: { AFormRemoteAutocompleteWithCached: true, ACachedUserChip: true },
      },
    })
    await flushPromises()
    await flushPromises()
  }
  const save = () => document.body.querySelector<HTMLButtonElement>('[data-cy="button-save"]')!
  const saves = () => dam.sentTo('PATCH', dam.routes.bulkMetadata)
  const refuseSaves = (answer: FakeDamAnswer) =>
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url) ? answer : undefined
    )
  const saved = async () => {
    save().click()
    await vi.waitFor(() => expect(saves()).toHaveLength(1))
    await vi.waitFor(() => expect(save().classList.contains('v-btn--loading')).toBe(false))
    await flushPromises()
  }
  const systemError = ['error', alertText('common.alert.unknownError')]
  /** The one alert of a refusal by validation: its heading, and the field each of its lines names. */
  const refusalSaid = () => {
    expect(shownAlerts()).toHaveLength(1)
    const [[colour, text]] = shownAlerts() as Array<[string, string]>
    const [heading, ...lines] = text.split('\n')

    return { colour, heading, fields: lines.map((line) => line.split(': ')[0]) }
  }

  it('sends the asset as the detail holds it, and says the record was updated', async () => {
    await openDetail()

    await saved()

    expect(saves().map((request) => request.url)).toEqual([`${endPoints.asset}/metadata-bulk-update`])
    expect(dam.body(saves()[0])).toMatchObject([
      { id: 'asset-1', described: true, customData: { description: 'from the server' } },
    ])
    expect(shownAlerts()).toEqual([['success', alertText('common.alert.recordWas.updated')]])
  })

  // Nothing reads what the DAM answers the save with.
  it('says the record was updated also when the DAM answers with 200 and no list', async () => {
    refuseSaves({ status: 200, data: {} })
    await openDetail()

    await saved()

    expect(shownAlerts()).toEqual([['success', alertText('common.alert.recordWas.updated')]])
  })

  // Once, and by the name the form gives the field: the save used to say a refusal itself and have the sidebar say
  // it again, the second time by the key of the request.
  it.each([
    ['a custom field by the name its form gives it', '[0].customData.description', 'Description of the image'],
    ['the keywords by theirs', '[0].keywords', alertText('common.damImage.asset.model.keywords')],
  ])('says once which field the DAM refuses: %s', async (_what, key, name) => {
    const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
    elements.find((element) => element.property === 'description')!.name = 'Description of the image'
    refuseSaves({
      status: 422,
      data: { contextId: 'context', error: 'validation_failed', fields: { [key]: ['error_field_empty'] } },
    })
    await openDetail()

    await saved()

    expect(refusalSaid()).toEqual({
      colour: 'error',
      heading: alertText('common.alert.fixApiValidationErrors'),
      fields: [name],
    })
  })

  it.each<[string, FakeDamAnswer, string[]]>([
    ['answers with 201', { status: 201, data: [] }, systemError],
    ['answers with 204', { status: 204 }, systemError],
    ['answers with 500', { status: 500 }, systemError],
    ['forbids the save', { status: 403 }, ['error', alertText('common.alert.forbiddenError')]],
  ])('says the save failed, as the kind of the failure is, when the DAM %s', async (_what, answer, alert) => {
    refuseSaves(answer)
    await openDetail()

    await saved()

    expect(shownAlerts()).toEqual([alert])
  })
})
