import {
  type DamConfigLicenceExtSystem,
  type DamConfigLicenceExtSystemReturnType,
  type DamExtSystemConfig,
  type DamPrvConfig,
  type DamPubConfig,
  UserAuthType,
} from '@/types/coreDam/DamConfig'
import { DamAssetType, type DamDistributionServiceName } from '@/types/coreDam/Asset'
import type { CustomDataFormElement } from '@/components/customDataForm/CustomDataForm'
import type { AxiosInstance } from 'axios'
import { isNull, isUndefined } from '@/utils/common'
import {
  fetchConfiguration,
  fetchExtSystemConfiguration,
  fetchPubConfiguration,
} from '@/components/damImage/uploadQueue/composables/damConfigApi'
import type { IntegerId } from '@/types/common'
import {
  fetchAssetCustomFormElements,
  fetchDistributionCustomFormElements,
} from '@/components/damImage/uploadQueue/composables/damAssetCustomFormApi'
import { reactive, shallowRef } from 'vue'
import { fetchDamAssetLicence } from '@/components/damImage/uploadQueue/api/damAssetLicenceApi'

const initialized = reactive<{
  damPubConfig: boolean
  damPrvConfig: boolean
}>({
  damPubConfig: false,
  damPrvConfig: false,
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

const damConfigExtSystem = shallowRef(new Map<IntegerId, DamExtSystemConfig>())
const damConfigLicenceExtSystem = shallowRef(new Map<IntegerId, DamConfigLicenceExtSystem>())

const damConfigAssetCustomFormElements = shallowRef(
  new Map<IntegerId, { [key in DamAssetType]: CustomDataFormElement[] }>()
)

const damConfigDistributionCustomFormElements = shallowRef(
  new Map<DamDistributionServiceName, CustomDataFormElement[]>()
)

export function useDamConfigState(client: undefined | (() => AxiosInstance) = undefined) {
  function onConfigError(error: Error) {
    console.error(error)
  }

  function loadDamPubConfig() {
    return new Promise((resolve, reject) => {
      initialized.damPubConfig = false
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

  function isDamPubConfigLoaded() {
    return initialized.damPubConfig
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

  function isDamPrvConfigLoaded() {
    return initialized.damPrvConfig
  }

  function loadDamConfigExtSystem(extSystemId: IntegerId) {
    return new Promise((resolve, reject) => {
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
          onConfigError(err)
          reject(false)
        })
    })
  }

  function setDamConfigExtSystem(data: DamExtSystemConfig, extSystemId: IntegerId) {
    try {
      const config = {
        assetExternalProviders: data.assetExternalProviders,
        audio: data.audio,
        document: data.document,
        image: data.image,
        video: data.video,
      }
      damConfigExtSystem.value.set(extSystemId, config)
    } catch (err) {
      throw new Error('Unable to load dam ext system config. Incorrect fields in json.')
    }
  }

  function getDamConfigExtSystem(extSystemId: IntegerId) {
    return damConfigExtSystem.value.get(extSystemId)
  }

  async function getOrLoadDamConfigExtSystemByLicence(
    licence: IntegerId
  ): Promise<DamConfigLicenceExtSystemReturnType | undefined> {
    if (isUndefined(client)) {
      return undefined
    }
    let foundLicenceConfig = damConfigLicenceExtSystem.value.get(licence)
    if (isUndefined(foundLicenceConfig)) {
      try {
        const licenceRes = await fetchDamAssetLicence(client, licence)
        if (isNull(licenceRes.extSystem)) return undefined
        foundLicenceConfig = { extSystem: licenceRes.extSystem, name: licenceRes.name }
        damConfigLicenceExtSystem.value.set(licence, foundLicenceConfig)
      } catch (e) {
        return undefined
      }
    }
    let foundExtSystemConfig = damConfigExtSystem.value.get(foundLicenceConfig.extSystem)
    if (isUndefined(foundExtSystemConfig)) {
      try {
        await loadDamConfigExtSystem(foundLicenceConfig.extSystem)
        foundExtSystemConfig = damConfigExtSystem.value.get(foundLicenceConfig.extSystem)
      } catch (e) {
        return undefined
      }
    }
    if (isUndefined(foundExtSystemConfig)) return undefined

    return {
      licence: licence,
      extSystem: foundLicenceConfig.extSystem,
      licenceName: foundLicenceConfig.name,
      extSystemConfig: foundExtSystemConfig,
    }
  }

  async function getOrLoadDamConfigExtSystemByLicences(
    licences: IntegerId[]
  ): Promise<DamConfigLicenceExtSystemReturnType[]> {
    const promises: Array<Promise<DamConfigLicenceExtSystemReturnType | undefined>> = []
    licences.forEach((licence: IntegerId) => {
      promises.push(getOrLoadDamConfigExtSystemByLicence(licence))
    })
    const responses = await Promise.all(promises)
    return responses.filter((response): response is DamConfigLicenceExtSystemReturnType => !isUndefined(response))
  }

  // todo add support to load only selected types
  function loadDamConfigAssetCustomFormElements(extSystemId: IntegerId) {
    return new Promise((resolve, reject) => {
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
      const config = {
        image: responses[0].data,
        audio: responses[1].data,
        video: responses[2].data,
        document: responses[3].data,
      }
      damConfigAssetCustomFormElements.value.set(extSystemId, config)
    } catch (err) {
      throw new Error('Unable to load asset custom form config. Incorrect fields in json.')
    }
  }

  function getDamConfigAssetCustomFormElements(extSystemId: IntegerId) {
    return damConfigAssetCustomFormElements.value.get(extSystemId)
  }

  function loadDamConfigDistributionCustomFormElements (distributionServiceName: DamDistributionServiceName) {
    return new Promise((resolve, reject) => {
      if (isUndefined(client)) {
        reject(false)
        return
      }
      if (damConfigDistributionCustomFormElements.value.has(distributionServiceName)) {
        resolve(true)
        return
      }
      fetchDistributionCustomFormElements(client, distributionServiceName)
        .then((res) => {
          damConfigDistributionCustomFormElements.value.set(distributionServiceName , res.data)
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
    damConfigLicenceExtSystem,
    damConfigAssetCustomFormElements,
    damConfigDistributionCustomFormElements,
    getOrLoadDamConfigExtSystemByLicence,
    getOrLoadDamConfigExtSystemByLicences,
    loadDamPrvConfig,
    loadDamPubConfig,
    loadDamConfigExtSystem,
    loadDamConfigAssetCustomFormElements,
    loadDamConfigDistributionCustomFormElements,
    isDamPubConfigLoaded,
    isDamPrvConfigLoaded,
    getDamConfigExtSystem,
    getDamConfigAssetCustomFormElements,
  }
}
