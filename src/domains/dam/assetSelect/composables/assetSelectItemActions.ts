import { computed, type Ref, watch } from 'vue'
import type { AssetSearchListItemDto } from '@/domains/dam/types/Asset'
import type { AssetSelectListItem } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'
import { useDamCachedAssetLicences } from '@/domains/dam/user/composables/cachedAssetLicences'

const IMAGE_HEIGHT = 200
const IMAGE_BG_COLOR_DEFAULT = '#ccc'

/** Call it in the setup of a list item: the item inherits the DAM configuration of its asset select. */
export function useAssetItemActions(item: Readonly<Ref<AssetSelectListItem>>) {
  const asset = computed<AssetSearchListItemDto>(() => {
    return item.value.asset
  })

  const assetType = computed(() => {
    return asset.value.attributes.assetType
  })

  const assetStatus = computed(() => {
    return asset.value.attributes.assetStatus
  })

  const imageProperties = computed(() => {
    if (asset.value.mainFile && asset.value.mainFile.links && asset.value.mainFile.links.image_list) {
      return {
        url: asset.value.mainFile.links.image_list.url,
        width: asset.value.mainFile.links.image_list.width,
        height: asset.value.mainFile.links.image_list.height,
        bgColor: IMAGE_BG_COLOR_DEFAULT,
      }
    }
    return {
      url: undefined,
      width: undefined,
      height: IMAGE_HEIGHT,
      bgColor: IMAGE_BG_COLOR_DEFAULT,
    }
  })

  const tableImageProperties = computed(() => {
    if (asset.value.mainFile && asset.value.mainFile.links && asset.value.mainFile.links.image_table) {
      return {
        url: asset.value.mainFile.links.image_table.url,
        width: asset.value.mainFile.links.image_table.width,
        height: asset.value.mainFile.links.image_table.height,
        bgColor: IMAGE_BG_COLOR_DEFAULT,
      }
    }
    return {
      url: undefined,
      width: undefined,
      height: IMAGE_HEIGHT,
      bgColor: IMAGE_BG_COLOR_DEFAULT,
    }
  })

  // The badge of the asset's licence, only where the configuration turns it on (`showLicenceBadgeEnabled`).
  const configName = inheritedDamConfigName()
  const { showLicenceBadgeEnabled } = useCommonAdminCoreDamOptions(configName)
  const { addToCachedAssetLicences, fetchCachedAssetLicences, getCachedAssetLicence } =
    useDamCachedAssetLicences(configName)
  if (showLicenceBadgeEnabled) {
    // The cache's fetch is debounced: the items of one list load their licences in one request.
    watch(
      () => asset.value.licence,
      (licence) => {
        addToCachedAssetLicences(licence)
        fetchCachedAssetLicences()
      },
      { immediate: true }
    )
  }
  const licenceBadge = computed(() =>
    showLicenceBadgeEnabled ? (getCachedAssetLicence(asset.value.licence)?.badge ?? '') : ''
  )

  return {
    asset,
    assetType,
    assetStatus,
    imageProperties,
    tableImageProperties,
    licenceBadge,
  }
}
