import { acceptHMRUpdate, defineStore, type Pinia } from 'pinia'
import { reactive, shallowRef } from 'vue'
import {
  type DamConfigLicenceExtSystem,
  type DamExtSystemConfig,
  type DamPrvConfig,
  type DamPubConfig,
  UserAuthType,
} from '@/domains/dam/types/DamConfig'
import type { IntegerId } from '@/shared/types/common'
import { type DamAssetTypeType, type DamDistributionServiceName } from '@/domains/dam/types/Asset'
import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'

const damPubConfigDefault = () => ({
  userAuthType: UserAuthType.JsonCredentials,
})
const damPrvConfigDefault = () => ({
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

const damConfigStoreSetup = () => {
  const initialized = reactive<{
    damPubConfig: boolean
    damPrvConfig: boolean
  }>({
    damPubConfig: false,
    damPrvConfig: false,
  })
  const damPubConfig = shallowRef<DamPubConfig>(damPubConfigDefault())
  const damPrvConfig = shallowRef<DamPrvConfig>(damPrvConfigDefault())
  const damConfigExtSystem = shallowRef(new Map<IntegerId, DamExtSystemConfig>())
  const damConfigLicenceExtSystem = shallowRef(new Map<IntegerId, DamConfigLicenceExtSystem>())
  const damConfigAssetCustomFormElements = shallowRef(
    new Map<IntegerId, { [key in DamAssetTypeType]: CustomDataFormElement[] }>()
  )
  const damConfigDistributionCustomFormElements = shallowRef(
    new Map<DamDistributionServiceName, CustomDataFormElement[]>()
  )

  function reset() {
    damPubConfig.value = damPubConfigDefault()
    damPrvConfig.value = damPrvConfigDefault()
    damConfigExtSystem.value.clear()
    damConfigLicenceExtSystem.value.clear()
    damConfigAssetCustomFormElements.value.clear()
    damConfigDistributionCustomFormElements.value.clear()
    initialized.damPrvConfig = false
    initialized.damPubConfig = false
  }

  return {
    initialized,
    damPubConfig,
    damPrvConfig,
    damConfigExtSystem,
    damConfigLicenceExtSystem,
    damConfigAssetCustomFormElements,
    damConfigDistributionCustomFormElements,
    reset,
  }
}

/** The DAM configuration store of the configuration `default`. */
export const useDamConfigStore = defineStore('commonAdminDamConfigStore', damConfigStoreSetup)

/** A DAM configuration store of `default` or another name. Its `$id` is per name. */
export type DamConfigStore = Omit<ReturnType<typeof useDamConfigStore>, '$id'> & { readonly $id: string }

interface DamConfigStoreHotData {
  namedDamConfigDefinitions?: Map<string, typeof useDamConfigStore>
  damConfigStoreSetup?: typeof damConfigStoreSetup
}
// Kept across hot updates (development only). Each version writes its setup here and they
// share the named store definitions, which importers of the first version keep creating.
// @ts-ignore vue-tsc v3 --build mode bug: import.meta.hot type not resolved for this file
const hotData: DamConfigStoreHotData | undefined = import.meta.hot?.data
if (hotData) hotData.damConfigStoreSetup = damConfigStoreSetup

// One definition per configuration name, created on first use. Names never share a store.
const namedDefinitions = hotData?.namedDamConfigDefinitions ?? new Map<string, typeof useDamConfigStore>()
if (hotData) hotData.namedDamConfigDefinitions = namedDefinitions

/**
 * DAM configuration store of `configName`. For `default` the
 * `useDamConfigStore()` store, else a separate store with the same members.
 * A named configuration loads into it. An app whose named client
 * cannot load it fills this store before its components mount.
 */
export function useDamConfigStoreOf(configName = 'default', pinia?: Pinia): DamConfigStore {
  if (configName === 'default') return useDamConfigStore(pinia)
  let definition = namedDefinitions.get(configName)
  if (!definition) {
    // Uses the setup of the latest hot-updated version of this module.
    definition = defineStore(
      'commonAdminDamConfigStore:' + configName,
      hotData?.damConfigStoreSetup ?? damConfigStoreSetup
    ) as unknown as typeof useDamConfigStore
    namedDefinitions.set(configName, definition)
  }

  return definition(pinia)
}

// @ts-ignore vue-tsc v3 --build mode bug: import.meta.hot type not resolved for this file
if (import.meta.hot) {
  // @ts-ignore see above
  const hot = import.meta.hot
  const acceptDefault = acceptHMRUpdate(useDamConfigStore, hot)
  hot.accept((newModule: unknown) => {
    // Named store definitions are created at runtime, not exported, so the new
    // module cannot give them a new setup. Reload the page while any exists.
    if (namedDefinitions.size > 0) {
      window.location.reload()
      return
    }
    acceptDefault(newModule)
  })
}
