import { coreDamOptions, imageOptions } from '@/plugins/pluginOptions'
import { isUndefined } from '@/shared/utils/common'
import type { DocId } from '@/shared/types/common'
import type { AssetSingleUseUsage } from '@/domains/dam/types/Asset'
import type { AssetSelectUsageHolder } from '@/domains/dam/types/AssetSelect'
import { fetchSingleUseUsage as fetchSingleUseUsageApi } from '@/domains/dam/imageWidget/composables/imageApiCms'

/**
 * How the asset picker of DAM configuration `configName` asks the CMS where single use photos are used: through the
 * image configuration of the same name, its `imageApi.fetchSingleUseUsage`, else core-cms when it has no `imageApi`.
 * `undefined` asks nobody: a DAM configuration without `singleUseUsageEnabled` (all but admin-cms: their backends,
 * daily tools of admin-inhouse too, have no usage check), no image configuration of that name (the DAM admin), or
 * an own `imageApi` without `fetchSingleUseUsage`.
 */
export function useImageSingleUseUsageFetch(configName: string) {
  const damConfigs = coreDamOptions.value?.configs
  const damConfig = damConfigs && Object.hasOwn(damConfigs, configName) ? damConfigs[configName] : undefined
  if (damConfig?.singleUseUsageEnabled !== true) return undefined
  const configs = imageOptions.value?.configs
  const config = configs && Object.hasOwn(configs, configName) ? configs[configName] : undefined
  if (isUndefined(config)) return undefined
  const fetchUsage = config.imageApi ? config.imageApi.fetchSingleUseUsage : fetchSingleUseUsageApi
  if (isUndefined(fetchUsage)) return undefined

  return (groupIds: DocId[], usageHolder: AssetSelectUsageHolder | null): Promise<Record<DocId, AssetSingleUseUsage>> =>
    fetchUsage(config.imageClient, groupIds, usageHolder)
}
