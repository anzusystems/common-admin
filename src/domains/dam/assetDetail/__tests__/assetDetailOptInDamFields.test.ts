import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import type { CommonAdminCoreDamConfig } from '@/AnzuSystemsCommonAdmin'
import {
  cmsConfiguration,
  type ConsumerProfile,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAsset, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { damText, forgetAlerts, uiText } from '@/domains/dam/__tests__/support/uploadUi'
import AssetImageMetaIcons from '@/domains/dam/assetDetail/components/AssetImageMetaIcons.vue'
import AssetMetadata from '@/domains/dam/assetDetail/components/AssetMetadata.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AssetSelectTableRowItem from '@/domains/dam/assetSelect/components/AssetSelectTableRowItem.vue'
import AssetSelectTilesItem from '@/domains/dam/assetSelect/components/AssetSelectTilesItem.vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { useDamCachedAssetLicences } from '@/domains/dam/user/composables/cachedAssetLicences'
import type { IntegerId } from '@/shared/types/common'
import { dateNow } from '@/shared/utils/datetime'

// What the DAM sends to every admin and only some show: when an asset is deleted automatically, the asset's
// licence and the licence's badge. Each is off unless the application turns it on in its DAM configuration
// (`showAutoDeleteEnabled`, `showLicenceEnabled`, `showLicenceBadgeEnabled`), as admin-ugc turns the file info off.

const { extSystem } = cmsConfiguration
const LICENCES = /^\/adm\/v1\/asset-licence\?/

let pinia: Pinia
let dam: FakeDam
let wrapper: VueWrapper | undefined
// The licence cache is shared by the file, so each case asks for a licence no earlier case asked for.
let licence: IntegerId = 900000

const withOptions = (options: Partial<CommonAdminCoreDamConfig>): ConsumerProfile => ({
  ...cmsConfiguration,
  options: (damClient: () => AxiosInstance) => {
    const plugin = cmsConfiguration.options(damClient)
    const configs = plugin.coreDam.configs
    return {
      ...plugin,
      coreDam: { ...plugin.coreDam, configs: { ...configs, default: { ...configs.default, ...options } } },
    }
  },
})

const start = (options: Partial<CommonAdminCoreDamConfig> = {}) => {
  installConsumerProfile(withOptions(options), dam.client)
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(cmsConfiguration.endPoints)
  answerDamNames(dam)
  dam.reply((request) => {
    if (request.method !== 'GET' || !LICENCES.test(request.url)) return undefined
    return { status: 200, data: { data: [{ id: licence, name: 'Fotobanka', badge: 'FB' }], totalCount: 1 } }
  })
  forgetAlerts()
  licence++
})
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  await damNamesAsked()
})

const licenceLookups = () => dam.requests.filter((request) => LICENCES.test(request.url))
// The cache asks 1.5 s after it is given an id. Not given it at all is what the cases without the option check.
const licenceQueued = () => useDamCachedAssetLicences('default').hasCachedAssetLicence(licence)
const inThreeDays = () => new Date(dateNow().getTime() + (3 * 24 + 1) * 3600_000).toISOString()

describe('the asset detail', () => {
  const mountDetail = async (autoDeleteAt: string | null) => {
    useAssetDetailStore(pinia).setAsset(
      damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, { licence, autoDeleteAt })
    )
    wrapper = mount(AssetMetadata, {
      props: { extSystem, readonly: true },
      attachTo: document.body,
      global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true } },
    })
    await flushPromises()
  }
  const autoDeleteRow = () => wrapper!.find('[data-cy="asset-auto-delete"]')
  const licenceRow = () => wrapper!.find('[data-cy="asset-licence"]')

  it('shows neither the automatic deletion nor the licence, and asks for no licence, by default', async () => {
    start()
    await mountDetail(inThreeDays())

    expect(autoDeleteRow().exists()).toBe(false)
    expect(licenceRow().exists()).toBe(false)
    expect(licenceQueued()).toBe(false)
  })

  it('shows the time left until the automatic deletion where the configuration turns it on', async () => {
    start({ showAutoDeleteEnabled: true })
    await mountDetail(inThreeDays())

    expect(autoDeleteRow().text()).toContain(damText('asset.model.autoDelete'))
    expect(autoDeleteRow().text()).toContain(uiText('common.time.long.remainingDays', { value: 3 }))
  })

  it('shows no automatic deletion for an asset DAM does not delete, even where it is on', async () => {
    start({ showAutoDeleteEnabled: true })
    await mountDetail(null)

    expect(autoDeleteRow().exists()).toBe(false)
  })

  it("shows the asset's licence by name where the configuration turns it on", async () => {
    start({ showLicenceEnabled: true })
    await mountDetail(null)

    expect(licenceRow().text()).toContain(damText('asset.detail.info.field.licence'))
    await vi.waitFor(() => expect(licenceRow().text()).toContain('Fotobanka'), { timeout: 5000 })
    expect(licenceLookups()).toHaveLength(1)
  })
})

describe.each([
  ['an asset select tile', AssetSelectTilesItem],
  ['an asset select table row', AssetSelectTableRowItem],
])('%s', (_what, item) => {
  const mountTile = async () => {
    wrapper = mount(item, {
      props: {
        index: 0,
        item: {
          asset: { ...damAsset('asset-1', { licence }), autoDeleteAt: null } as never,
          selected: false,
          active: false,
        },
        showMetaIcons: true,
      },
      attachTo: document.body,
      global: { plugins: [pinia] },
    })
    await flushPromises()
  }
  const badge = () => wrapper!.find('[data-cy="asset-licence-badge"]')

  it('shows no licence badge and asks for no licence by default', async () => {
    start()
    await mountTile()

    expect(badge().exists()).toBe(false)
    expect(licenceQueued()).toBe(false)
  })

  it("shows the badge of the asset's licence where the configuration turns it on", async () => {
    start({ showLicenceBadgeEnabled: true })
    await mountTile()

    await vi.waitFor(() => expect(badge().text()).toBe('FB'), { timeout: 5000 })
  })
})

describe('the meta icons of an asset', () => {
  it.each([
    ['show the badge of the licence they are given', 'FB', true],
    ['show none for an empty badge', '', false],
  ])('%s', (_what, licenceBadge, shown) => {
    wrapper = mount(AssetImageMetaIcons, {
      props: {
        assetType: DamAssetType.Image,
        assetFileProperties: { distributesInServices: [], slotNames: [], fromRss: false, width: 0, height: 0 },
        licenceBadge,
      },
      attachTo: document.body,
      global: { plugins: [pinia] },
    })

    expect(wrapper.find('[data-cy="asset-licence-badge"]').exists()).toBe(shown)
    expect(wrapper.find('.asset-image__meta-icons').isVisible()).toBe(shown)
  })
})
