import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { useDamCachedAssetLicences } from '@/domains/dam/user/composables/cachedAssetLicences'

/**
 * The take over switch of a picker: offered once a picked photo is of another licence than the upload licence, and
 * locked on while one of them is of a licence without direct use. `enabled` off (`copyToLicenceEnabled: false`)
 * offers it never. Picks survive a change of the browsed licence, so each asset's own licence decides.
 * Call in setup. `configName`: the DAM configuration whose licences tell whether they allow direct use.
 */
export function useAssetSelectTakeOver(
  options: {
    uploadLicence: () => IntegerId | undefined
    isImage: () => boolean
    enabled?: () => boolean
  },
  configName: string
) {
  const { selectedAssets } = storeToRefs(useAssetSelectStore())
  const { getCachedAssetLicence } = useDamCachedAssetLicences(configName)

  const takeOver = ref(false)

  const selectedOutsideUploadLicence = computed(() =>
    [...selectedAssets.value.values()].filter((item) => item.asset.licence !== options.uploadLicence())
  )

  const showTakeOver = computed(
    () =>
      (options.enabled?.() ?? true) &&
      options.isImage() &&
      !isUndefined(options.uploadLicence()) &&
      selectedOutsideUploadLicence.value.length > 0
  )

  const takeOverLocked = computed(
    () =>
      showTakeOver.value &&
      selectedOutsideUploadLicence.value.some(
        (item) => getCachedAssetLicence(item.asset.licence)?.flags?.directUseAllowed === false
      )
  )

  const takeOverModel = computed({
    get: () => takeOverLocked.value || takeOver.value,
    set: (value: boolean) => {
      takeOver.value = value
    },
  })

  const getForceTakeOver = () => showTakeOver.value && takeOverModel.value

  return { showTakeOver, takeOverLocked, takeOverModel, getForceTakeOver }
}
