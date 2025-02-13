import { acceptHMRUpdate, defineStore } from 'pinia'
import { reactive, shallowRef } from 'vue'
import {
  type DamConfigLicenceExtSystem,
  type DamExtSystemConfig,
  type DamPrvConfig,
  type DamPubConfig,
  UserAuthType,
} from '@/types/coreDam/DamConfig'
import type { IntegerId } from '@/types/common'
import { type DamAssetTypeType, type DamDistributionServiceName } from '@/types/coreDam/Asset'
import type { CustomDataFormElement } from '@/components/customDataForm/CustomDataForm'

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

export const useDamConfigStore = defineStore('commonAdminDamConfigStore', () => {
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
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDamConfigStore, import.meta.hot))
}
