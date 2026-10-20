import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'
import { fetchDamAssetLicence } from '@/domains/dam/api/damAssetLicenceApi'
import {
  fetchAssetCustomFormElements,
  fetchDistributionCustomFormElements,
} from '@/domains/dam/config/api/damAssetCustomFormApi'
import {
  fetchConfiguration,
  fetchExtSystemConfiguration,
  fetchPubConfiguration,
} from '@/domains/dam/config/api/damConfigApi'
import { useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'
import { checkDamConfigName, inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'
import { damEndPointsOf } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import type { IntegerId } from '@/shared/types/common'
import { DamAssetType, type DamAssetTypeType, type DamDistributionServiceName } from '@/domains/dam/types/Asset'
import type {
  DamConfigLicenceExtSystemReturnType,
  DamExtSystemConfig,
  DamPrvConfig,
  DamPubConfig,
} from '@/domains/dam/types/DamConfig'
import { cloneDeep, isNull, isUndefined } from '@/shared/utils/common'
import type { AxiosInstance } from 'axios'

// The types of asset whose custom fields are not loaded, by the custom fields of an ext system the loader stored: their
// read failed beside reads that answered. Those stay `[]` there, as the store has always held them, and are read again
// where they are needed. By the stored object, not by the ext system: one an application writes into the store itself
// has every type loaded.
const customFormTypesNotLoaded = new WeakMap<object, ReadonlySet<DamAssetTypeType>>()

/**
 * Loads into and reads from the DAM configuration store of `configName` (`useDamConfigStoreOf`); a name left out is
 * the inherited one in a component's setup, else `default`. Without a client nothing loads. It loads from the
 * addresses that configuration sets (`endPointConfiguration`, `endPointPubConfiguration`, `endPointAssetLicence`,
 * `endPointAssetCustomForm`), the default ones where it sets none or the plugin is not configured yet. Once the plugin
 * has set the options, a configuration the application has not got throws, as the caches of names do.
 */
export function useDamConfigState(client: undefined | (() => AxiosInstance) = undefined, configName?: string) {
  const name = inheritedDamConfigName(configName)
  checkDamConfigName(name)
  const damConfigStore = useDamConfigStoreOf(name)
  // Read when a request is made.
  const endPoints = () => damEndPointsOf(name)

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
      fetchPubConfiguration(client, endPoints().endPointPubConfiguration)
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
      if (isUndefined(client)) {
        reject(false)
        return
      }
      fetchConfiguration(client, endPoints().endPointConfiguration)
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
      fetchExtSystemConfiguration(extSystemId, client, endPoints().endPointConfiguration)
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
      const { endPointAssetCustomForm } = endPoints()
      const promises = types.map((type) =>
        fetchAssetCustomFormElements(client, extSystemId, type, endPointAssetCustomForm)
      )

      // allSettled: one unavailable type must not discard the successfully loaded ones.
      Promise.allSettled(promises)
        .then((results) => {
          const loadedTypes: DamAssetTypeType[] = []
          const loadedResponses: CustomDataFormElement[][] = []
          const failedTypes: DamAssetTypeType[] = []

          // A read that answers is loaded, also when it brings no field: an ext system may have none for a type, or
          // for any, and that is its configuration. Counted as failed, an ext system without a custom field never
          // had one, and whatever waits for it said it could not be loaded.
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              loadedTypes.push(types[index]!)
              loadedResponses.push(result.value)
              return
            }
            failedTypes.push(types[index]!)
          })

          // A read that failed beside reads that answered with no field: nothing tells an ext system without a field
          // from one whose fields are in the very part that failed. Not loaded, as before.
          const anyField = loadedResponses.some((fields) => fields.length > 0)
          if (types.length > 0 && (loadedTypes.length === 0 || (failedTypes.length > 0 && !anyField))) {
            throw new Error('Unable to load asset custom form config. Incorrect response body.')
          }
          setDamConfigAssetCustomFormElements(loadedResponses, extSystemId, loadedTypes, failedTypes)
          if (failedTypes.length > 0) {
            onConfigError(new Error(`Unable to load asset custom form config for: ${failedTypes.join(', ')}.`))
          }
          resolve(true)
        })
        .catch((err) => {
          onConfigError(err)
          reject(false)
        })
    })
  }

  function setDamConfigAssetCustomFormElements(
    responses: CustomDataFormElement[][],
    extSystemId: IntegerId,
    types: DamAssetTypeType[],
    failedTypes: DamAssetTypeType[] = []
  ) {
    try {
      const storedConfig = damConfigStore.damConfigAssetCustomFormElements.get(extSystemId)
      const existingConfig = storedConfig || {
        image: [],
        audio: [],
        video: [],
        document: [],
      }

      const config = { ...existingConfig }

      types.forEach((type, index) => {
        config[type] = responses[index]!
      })

      // Not loaded: the types whose read failed now, and those not loaded before that were not read again. A type the
      // stored object holds loaded is not marked by a read of it that failed: two reads go at once (two widgets of a
      // page), and the one that failed may answer last.
      const notLoadedBefore = storedConfig ? customFormTypesNotLoaded.get(storedConfig) : undefined
      const failedNotLoaded = failedTypes.filter((type) => !storedConfig || !!notLoadedBefore?.has(type))
      const notLoaded = new Set(
        [...(notLoadedBefore ?? []), ...failedNotLoaded].filter((type) => !types.includes(type))
      )
      if (notLoaded.size > 0) customFormTypesNotLoaded.set(config, notLoaded)

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
      fetchDistributionCustomFormElements(client, distributionServiceName, endPoints().endPointAssetCustomForm)
        .then((res) => {
          damConfigStore.damConfigDistributionCustomFormElements.set(distributionServiceName, res)
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

  /**
   * The custom fields of the assets of the ext system, by type of asset; `undefined` while they are not loaded. With
   * `assetType`, `undefined` also while the fields of that type are not: their read failed beside reads that answered,
   * and the type holds `[]` till it is read again.
   */
  function getDamConfigAssetCustomFormElements(extSystemId: IntegerId, assetType?: DamAssetTypeType) {
    const config = damConfigStore.damConfigAssetCustomFormElements.get(extSystemId)
    if (config && assetType && customFormTypesNotLoaded.get(config)?.has(assetType)) return undefined
    return config
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
        const licenceRes = await fetchDamAssetLicence(client, licence, endPoints().endPointAssetLicence)
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

  async function getExtSystemByLicence(licence: IntegerId): Promise<IntegerId | null> {
    const cached = damConfigStore.damConfigLicenceExtSystem.get(licence)
    if (cached) return cached.extSystem

    if (isUndefined(client)) return null

    try {
      const licenceRes = await fetchDamAssetLicence(client, licence, endPoints().endPointAssetLicence)
      if (isNull(licenceRes.extSystem)) return null

      damConfigStore.damConfigLicenceExtSystem.set(licence, {
        extSystem: licenceRes.extSystem,
        name: licenceRes.name,
      })
      return licenceRes.extSystem
    } catch (error) {
      console.error(`Error fetching asset licence for ${licence}:`, error)
      return null
    }
  }

  return {
    getOrLoadDamConfigExtSystemByLicences,
    getOrLoadDamConfigExtSystemByLicence,
    getExtSystemByLicence,
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
