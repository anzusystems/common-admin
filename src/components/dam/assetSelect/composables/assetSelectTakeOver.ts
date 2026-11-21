import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { IntegerId } from '@/types/common'
import { isUndefined } from '@/utils/common'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { useDamCachedAssetLicences } from '@/components/damImage/composables/cachedDamAssetLicences'

export function useAssetSelectTakeOver(options: {
  uploadLicence: () => IntegerId | undefined
  isImage: () => boolean
}) {
  const { selectedAssets } = storeToRefs(useAssetSelectStore())
  const { getCachedAssetLicence } = useDamCachedAssetLicences()

  const takeOver = ref(false)

  const selectedOutsideUploadLicence = computed(() =>
    [...selectedAssets.value.values()].filter(
      (item) => item.asset.licence !== options.uploadLicence(),
    ),
  )

  const showTakeOver = computed(
    () =>
      options.isImage() &&
      !isUndefined(options.uploadLicence()) &&
      selectedOutsideUploadLicence.value.length > 0,
  )

  const takeOverLocked = computed(
    () =>
      showTakeOver.value &&
      selectedOutsideUploadLicence.value.some(
        (item) => getCachedAssetLicence(item.asset.licence)?.flags?.directUseAllowed === false,
      ),
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
