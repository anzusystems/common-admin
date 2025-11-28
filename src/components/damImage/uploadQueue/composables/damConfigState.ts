import type { CustomDataFormElement } from '@/components/customDataForm/CustomDataForm'
import { fetchDamAssetLicence } from '@/components/damImage/uploadQueue/api/damAssetLicenceApi'
import {
  fetchAssetCustomFormElements,
  fetchDistributionCustomFormElements,
} from '@/components/damImage/uploadQueue/composables/damAssetCustomFormApi'
import {
  fetchConfiguration,
  fetchExtSystemConfiguration,
  fetchPubConfiguration,
} from '@/components/damImage/uploadQueue/composables/damConfigApi'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'
import type { IntegerId } from '@/types/common'
import { DamAssetType, type DamAssetTypeType, type DamDistributionServiceName } from '@/types/coreDam/Asset'
import type {
  DamConfigLicenceExtSystemReturnType,
  DamExtSystemConfig,
  DamPrvConfig,
  DamPubConfig,
} from '@/types/coreDam/DamConfig'
import { cloneDeep, isNull, isUndefined } from '@/utils/common'
import type { AxiosInstance } from 'axios'

export function useDamConfigState(client: undefined | (() => AxiosInstance) = undefined) {
  const damConfigStore = useDamConfigStore()

  function onConfigError(error: Error) {
    console.error(error)
  }

  function loadDamPubConfig() {
    return new Promise((resolve, reject) => {
      damConfigStore.initialized.damPubConfig = false
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
      damConfigStore.damPubConfig.userAuthType = data.userAuthType
      damConfigStore.initialized.damPubConfig = true
    } catch (err) {
      throw new Error('Unable to load dam pub config. Incorrect fields in json.')
    }
  }

  function loadDamPrvConfig() {
    return new Promise((resolve, reject) => {
      damConfigStore.initialized.damPubConfig = false
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
      damConfigStore.damPrvConfig.settings = data.settings
      damConfigStore.damPrvConfig.colorSet = data.colorSet
      damConfigStore.damPrvConfig.assetExternalProviders = data.assetExternalProviders
      damConfigStore.damPrvConfig.distributionServices = data.distributionServices
      damConfigStore.initialized.damPrvConfig = true
    } catch (err) {
      throw new Error('Unable to load dam config. Incorrect fields in json.')
    }
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
      damConfigStore.damConfigExtSystem.set(extSystemId, config)
    } catch (err) {
      throw new Error('Unable to load dam ext system config. Incorrect fields in json.')
    }
  }

  function loadDamConfigAssetCustomFormElements(
    extSystemId: IntegerId,
    types: DamAssetTypeType[] = [DamAssetType.Image, DamAssetType.Audio, DamAssetType.Video, DamAssetType.Document]
  ) {
    return new Promise((resolve, reject) => {
      if (isUndefined(client)) {
        reject(false)
        return
      }
      const promises = types.map((type) => fetchAssetCustomFormElements(client, extSystemId, type))

      Promise.all(promises)
        .then((responses) => {
          if (responses.length !== types.length || responses.some((response) => Object.keys(response).length < 1)) {
            throw new Error('Unable to load asset custom form config. Incorrect response body.')
          }
          setDamConfigAssetCustomFormElements(responses, extSystemId, types)
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
    extSystemId: IntegerId,
    types: DamAssetTypeType[]
  ) {
    try {
      const existingConfig = damConfigStore.damConfigAssetCustomFormElements.get(extSystemId) || {
        image: [],
        audio: [],
        video: [],
        document: [],
      }

      const config = { ...existingConfig }

      types.forEach((type, index) => {
        config[type] = responses[index].data
      })

      damConfigStore.damConfigAssetCustomFormElements.set(extSystemId, config)
    } catch (err) {
      throw new Error('Unable to load asset custom form config. Incorrect fields in json.')
    }
  }

  function loadDamConfigDistributionCustomFormElements(distributionServiceName: DamDistributionServiceName) {
    return new Promise((resolve, reject) => {
      if (isUndefined(client)) {
        reject(false)
        return
      }
      if (damConfigStore.damConfigDistributionCustomFormElements.has(distributionServiceName)) {
        resolve(true)
        return
      }
      fetchDistributionCustomFormElements(client, distributionServiceName)
        .then((res) => {
          damConfigStore.damConfigDistributionCustomFormElements.set(distributionServiceName, res.data)
          resolve(true)
          return
        })
        .catch((error) => {
          reject(error)
          return
        })
    })
  }

  function isDamPubConfigLoaded() {
    return damConfigStore.initialized.damPubConfig
  }

  function isDamPrvConfigLoaded() {
    return damConfigStore.initialized.damPrvConfig
  }

  function getDamConfigExtSystem(extSystemId: IntegerId) {
    return damConfigStore.damConfigExtSystem.get(extSystemId)
  }

  function getDamConfigAssetCustomFormElements(extSystemId: IntegerId) {
    return damConfigStore.damConfigAssetCustomFormElements.get(extSystemId)
  }

  async function getOrLoadDamConfigExtSystemByLicences(
    licences: IntegerId[]
  ): Promise<DamConfigLicenceExtSystemReturnType[]> {
    const promises = licences.map((licence) =>
      getOrLoadDamConfigExtSystemByLicence(licence).catch((error) => {
        console.error(`Error fetching licence ${licence}:`, error)
        return undefined
      })
    )

    const responses = await Promise.allSettled(promises)

    return responses
      .filter(
        (result): result is PromiseFulfilledResult<DamConfigLicenceExtSystemReturnType> =>
          result.status === 'fulfilled' && !isUndefined(result.value)
      )
      .map((result) => result.value)
  }

  async function getOrLoadDamConfigExtSystemByLicence(
    licence: IntegerId
  ): Promise<DamConfigLicenceExtSystemReturnType | undefined> {
    if (isUndefined(client)) {
      console.warn('Client is undefined')
      return undefined
    }

    let foundLicenceConfig = damConfigStore.damConfigLicenceExtSystem.get(licence)

    if (isUndefined(foundLicenceConfig)) {
      try {
        const licenceRes = await fetchDamAssetLicence(client, licence)
        if (isNull(licenceRes.extSystem)) return undefined

        foundLicenceConfig = {
          extSystem: licenceRes.extSystem,
          name: licenceRes.name,
        }
        damConfigStore.damConfigLicenceExtSystem.set(licence, foundLicenceConfig)
      } catch (error) {
        console.error(`Error fetching asset licence for ${licence}:`, error)
        return undefined
      }
    }

    let foundExtSystemConfig = damConfigStore.damConfigExtSystem.get(foundLicenceConfig.extSystem)

    if (isUndefined(foundExtSystemConfig)) {
      try {
        await loadDamConfigExtSystem(foundLicenceConfig.extSystem)
        foundExtSystemConfig = damConfigStore.damConfigExtSystem.get(foundLicenceConfig.extSystem)
      } catch (error) {
        console.error(`Error loading extension system ${foundLicenceConfig.extSystem}:`, error)
        return undefined
      }
    }

    if (isUndefined(foundExtSystemConfig)) return undefined

    return {
      licence,
      extSystem: foundLicenceConfig.extSystem,
      licenceName: foundLicenceConfig.name,
      extSystemConfig: cloneDeep(foundExtSystemConfig),
    }
  }

  return {
    getOrLoadDamConfigExtSystemByLicences,
    getOrLoadDamConfigExtSystemByLicence,
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
