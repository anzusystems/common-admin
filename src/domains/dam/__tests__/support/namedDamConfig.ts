import type { Pinia } from 'pinia'
import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'
import { CustomDataFormElementType } from '@/domains/customDataForm/types/CustomDataFormElementTypes'
import type { FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { type DamConfigStore, useDamConfigStore, useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import type { DamExtSystemConfig, DamPrvConfig } from '@/domains/dam/types/DamConfig'
import type { IntegerId } from '@/shared/types/common'

/**
 * Fills the store of configuration `name` like `default`'s, as an application does before its
 * components mount. The values are copies, so a later write to one store does not show in the other.
 */
export const seedDamConfigOf = (name: string, pinia?: Pinia): DamConfigStore => {
  const from = useDamConfigStore(pinia)
  const to = useDamConfigStoreOf(name, pinia)
  to.damPubConfig = { ...from.damPubConfig }
  to.damPrvConfig = structuredClone(from.damPrvConfig)
  to.damConfigExtSystem = new Map(structuredClone([...from.damConfigExtSystem]))
  to.damConfigLicenceExtSystem = new Map(structuredClone([...from.damConfigLicenceExtSystem]))
  to.damConfigAssetCustomFormElements = new Map(structuredClone([...from.damConfigAssetCustomFormElements]))
  to.damConfigDistributionCustomFormElements = new Map(
    structuredClone([...from.damConfigDistributionCustomFormElements])
  )
  to.initialized.damPubConfig = from.initialized.damPubConfig
  to.initialized.damPrvConfig = from.initialized.damPrvConfig

  return to
}

export interface DamConfigOfDam {
  extSystem: IntegerId
  licence: IntegerId
  fieldName: string
  keywords: boolean
  authors: boolean
  chunk: { minSize: number; maxSize: number }
  distribution: { title: string; iconPath: string }
  externalProvider: string
}

export const SHARED_FIELD = 'headline'
export const SHARED_SERVICE = 'youtube'
export const SHARED_PROVIDER = 'provider'

const imageElements = (of: DamConfigOfDam): CustomDataFormElement[] => [
  {
    id: `element-${of.fieldName}`,
    property: SHARED_FIELD,
    name: of.fieldName,
    position: 1,
    attributes: {
      type: CustomDataFormElementType.String,
      minValue: null,
      maxValue: 255,
      minCount: null,
      maxCount: null,
      required: false,
      searchable: false,
      readonly: false,
    },
  },
]
const extSystemConfig = (of: DamConfigOfDam): DamExtSystemConfig => ({
  image: {
    enabled: true,
    roiWidth: 16,
    roiHeight: 9,
    sizeLimit: 20971520,
    mimeTypes: ['image/jpeg', 'image/png'],
    authors: { enabled: of.authors, required: false },
    keywords: { enabled: of.keywords, required: false },
  } as DamExtSystemConfig['image'],
})
const prvConfig = (of: DamConfigOfDam): DamPrvConfig =>
  ({
    settings: {
      aclCheckEnabled: true,
      adminAllowListName: 'root',
      allowSelectExtSystem: false,
      allowSelectLicenceId: false,
      defaultAssetLicenceId: 0,
      defaultExtSystemId: 0,
      imageChunkConfig: { ...of.chunk },
      maxBulkItemCount: 0,
    },
    colorSet: {},
    assetExternalProviders: { [SHARED_PROVIDER]: { title: of.externalProvider } },
    distributionServices: {
      [SHARED_SERVICE]: { ...of.distribution, type: 'youtube', allowedRedistributeStatuses: [] },
    },
  }) as unknown as DamPrvConfig

export const fillDamConfigOf = (name: string, of: DamConfigOfDam, pinia?: Pinia): DamConfigStore => {
  const store = useDamConfigStoreOf(name, pinia)
  store.damPrvConfig = prvConfig(of)
  store.initialized.damPrvConfig = true
  store.damConfigLicenceExtSystem.set(of.licence, { name: of.fieldName, extSystem: of.extSystem })
  store.damConfigExtSystem.set(of.extSystem, extSystemConfig(of))
  store.damConfigAssetCustomFormElements.set(of.extSystem, {
    [DamAssetType.Image]: imageElements(of),
    [DamAssetType.Audio]: [],
    [DamAssetType.Video]: [],
    [DamAssetType.Document]: [],
  })

  return store
}

export const answerDamConfig = (dam: FakeDam, of: DamConfigOfDam) =>
  dam.reply((request) => {
    if (request.method !== 'GET') return undefined
    const [path] = request.url.split('?')
    if (path === `/adm/v1/asset-licence/${of.licence}`) {
      return { status: 200, data: { id: of.licence, name: of.fieldName, extSystem: of.extSystem } }
    }
    if (path === '/adm/v1/configuration') {
      return { status: 200, data: prvConfig(of) }
    }
    if (path === `/adm/v1/configuration/ext-system/${of.extSystem}`) {
      return { status: 200, data: extSystemConfig(of) }
    }
    const form = path!.match(/^\/adm\/v1\/asset-custom-form\/ext-system\/(\d+)\/type\/(\w+)\/element$/)
    if (form && Number(form[1]) === of.extSystem) {
      const found = form[2] === DamAssetType.Image ? imageElements(of) : []
      return { status: 200, data: { data: found, totalCount: found.length } }
    }
    return undefined
  })
