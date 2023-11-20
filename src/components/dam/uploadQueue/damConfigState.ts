import { reactive, shallowRef } from 'vue'
import {
  type DamPrvConfig,
  type DamExtSystemConfig,
  type DamPubConfig,
  type DamExtSystemConfigItem,
  UserAuthType,
} from '@/types/coreDam/DamConfig'
import { DamAssetType, type DamDistributionServiceName } from '@/types/coreDam/Asset'
import type { CustomDataFormElement } from '@/components/customDataForm/CustomDataForm'
import type { AxiosInstance } from 'axios'
import { isUndefined } from '@/utils/common'
import {
  fetchConfiguration,
  fetchExtSystemConfiguration,
  fetchPubConfiguration,
} from '@/components/dam/uploadQueue/damConfigApi'
import type { IntegerId } from '@/types/common'
import {
  fetchAssetCustomFormElements,
  fetchDistributionCustomFormElements,
} from '@/components/dam/uploadQueue/damAssetCustomFormApi'

const createDefaultExtSystemConfig = (override: Partial<DamExtSystemConfigItem> = {}): DamExtSystemConfigItem => ({
  ...({
    sizeLimit: 0,
    defaultFileVersion: '',
    versions: [],
    mimeTypes: [],
    distribution: {
      distributionServices: [],
      distributionRequirements: {},
    },
    keywords: {
      enabled: false,
      required: false,
    },
    authors: {
      enabled: false,
      required: false,
    },
    customMetadataPinnedAmount: 1,
    slots: [],
  } as DamExtSystemConfigItem),
  ...override,
})

const initialized = reactive<{
  damPubConfig: boolean
  damPrvConfig: boolean
  damConfigExtSystem: IntegerId | null
  damConfigAssetCustomFormElements: IntegerId | null
}>({
  damPubConfig: false,
  damPrvConfig: false,
  damConfigExtSystem: null,
  damConfigAssetCustomFormElements: null,
})

const damPubConfig = shallowRef<DamPubConfig>({
  userAuthType: UserAuthType.JsonCredentials,
})

const damPrvConfig = shallowRef<DamPrvConfig>({
  colorSet: {},
  assetExternalProviders: {},
  distributionServices: {},
  settings: {
    aclCheckEnabled: true,
    adminAllowListName: 'root',
    allowSelectExtSystem: false,
    allowSelectLicenceId: false,
    defaultAssetLicenceId: 0,
    defaultExtSystemId: 0,
    imageChunkConfig: {
      minSize: 0,
      maxSize: 0,
    },
    maxBulkItemCount: 0,
  },
})

const damConfigExtSystem = shallowRef<DamExtSystemConfig>({
  assetExternalProviders: {},
  audio: createDefaultExtSystemConfig(),
  document: createDefaultExtSystemConfig(),
  image: createDefaultExtSystemConfig(),
  video: createDefaultExtSystemConfig(),
})

const damConfigAssetCustomFormElements = shallowRef<{ [key in DamAssetType]: CustomDataFormElement[] }>({
  image: [],
  audio: [],
  video: [],
  document: [],
})

const damConfigDistributionCustomFormElements = shallowRef<Record<DamDistributionServiceName, CustomDataFormElement[]>>(
  {}
)

export function useDamConfigState(client: undefined | (() => AxiosInstance) = undefined) {
  function onConfigError(error: Error) {
    console.error(error)
  }

  function loadDamPubConfig() {
    return new Promise((resolve, reject) => {
      initialized.damPrvConfig = false
      if (isUndefined(client)) {
        reject(false)
        return
      }
      fetchPubConfiguration(client)
        .then((config) => {
          if (Object.keys(config).length < 1) {
            throw new Error('Unable to load pub config. Incorrect response body.')
          }
          setDamPubConfig(config)
          resolve(true)
        })
        .catch((err) => {
          onConfigError(err)
          reject(false)
        })
    })
  }

  function setDamPubConfig(data: DamPubConfig) {
    try {
      damPubConfig.value.userAuthType = data.userAuthType

      initialized.damPubConfig = true
    } catch (err) {
      throw new Error('Unable to load dam pub config. Incorrect fields in json.')
    }
  }

  function loadDamPrvConfig() {
    return new Promise((resolve, reject) => {
      initialized.damPubConfig = false
      if (isUndefined(client)) {
        reject(false)
        return
      }
      fetchConfiguration(client)
        .then((config) => {
          if (Object.keys(config).length < 1) {
            throw new Error('Unable to load dam prv config. Incorrect response body.')
          }
          setDamPrvConfig(config)
          resolve(true)
        })
        .catch((err) => {
          onConfigError(err)
          reject(false)
        })
    })
  }

  function setDamPrvConfig(data: DamPrvConfig) {
    try {
      damPrvConfig.value.settings = data.settings
      damPrvConfig.value.colorSet = data.colorSet
      damPrvConfig.value.assetExternalProviders = data.assetExternalProviders
      damPrvConfig.value.distributionServices = data.distributionServices

      initialized.damPrvConfig = true
    } catch (err) {
      throw new Error('Unable to load dam config. Incorrect fields in json.')
    }
  }

  function loadDamConfigExtSystem(extSystemId: IntegerId) {
    return new Promise((resolve, reject) => {
      initialized.damConfigExtSystem = null
      if (isUndefined(client)) {
        reject(false)
        return
      }
      fetchExtSystemConfiguration(extSystemId, client)
        .then((config) => {
          if (Object.keys(config).length < 1) {
            throw new Error('Unable to load dam ext system config. Incorrect response body.')
          }
          setDamConfigExtSystem(config, extSystemId)
          resolve(true)
        })
        .catch((err) => {
          console.log(err)
          onConfigError(err)
          reject(false)
        })
    })
  }

  function setDamConfigExtSystem(data: DamExtSystemConfig, extSystemId: IntegerId) {
    try {
      damConfigExtSystem.value.assetExternalProviders = data.assetExternalProviders
      damConfigExtSystem.value.audio = data.audio
      damConfigExtSystem.value.document = data.document
      damConfigExtSystem.value.image = data.image
      damConfigExtSystem.value.video = data.video

      initialized.damConfigExtSystem = extSystemId
    } catch (err) {
      throw new Error('Unable to load dam ext system config. Incorrect fields in json.')
    }
  }

  // todo add support to load only selected types
  function loadDamConfigAssetCustomFormElements(extSystemId: IntegerId) {
    return new Promise((resolve, reject) => {
      initialized.damConfigExtSystem = null
      if (isUndefined(client)) {
        reject(false)
        return
      }
      const promises = [
        fetchAssetCustomFormElements(client, extSystemId, DamAssetType.Image),
        fetchAssetCustomFormElements(client, extSystemId, DamAssetType.Audio),
        fetchAssetCustomFormElements(client, extSystemId, DamAssetType.Video),
        fetchAssetCustomFormElements(client, extSystemId, DamAssetType.Document),
      ]

      Promise.all(promises)
        .then((responses) => {
          if (
            responses.length !== 4 ||
            Object.keys(responses[0]).length < 1 ||
            Object.keys(responses[1]).length < 1 ||
            Object.keys(responses[2]).length < 1 ||
            Object.keys(responses[3]).length < 1
          ) {
            throw new Error('Unable to load asset custom form config. Incorrect response body.')
          }
          setDamConfigAssetCustomFormElements(responses, extSystemId)
          resolve(true)
        })
        .catch((err) => {
          onConfigError(err)
          reject(false)
        })
    })
  }

  function setDamConfigAssetCustomFormElements(
    responses: Awaited<{
      data: CustomDataFormElement[]
    }>[],
    extSystemId: IntegerId
  ) {
    try {
      damConfigAssetCustomFormElements.value.image = responses[0].data
      damConfigAssetCustomFormElements.value.audio = responses[1].data
      damConfigAssetCustomFormElements.value.video = responses[2].data
      damConfigAssetCustomFormElements.value.document = responses[3].data

      initialized.damConfigAssetCustomFormElements = extSystemId
    } catch (err) {
      throw new Error('Unable to load asset custom form config. Incorrect fields in json.')
    }
  }

  function loadDamConfigDistributionCustomFormElements (distributionServiceName: DamDistributionServiceName) {
    return new Promise((resolve, reject) => {
      if (isUndefined(client)) {
        reject(false)
        return
      }
      if (damConfigDistributionCustomFormElements.value[distributionServiceName]) {
        resolve(true)
        return
      }
      fetchDistributionCustomFormElements(client, distributionServiceName)
        .then((res) => {
          damConfigDistributionCustomFormElements.value[distributionServiceName] = res.data
          resolve(true)
          return
        })
        .catch((error) => {
          reject(error)
          return
        })
    })
  }

  return {
    initialized,
    damPubConfig,
    damPrvConfig,
    damConfigExtSystem,
    damConfigAssetCustomFormElements,
    damConfigDistributionCustomFormElements,
    loadDamPrvConfig,
    loadDamPubConfig,
    loadDamConfigExtSystem,
    loadDamConfigAssetCustomFormElements,
    loadDamConfigDistributionCustomFormElements,
  }
}
