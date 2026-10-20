import type { AxiosInstance } from 'axios'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

/**
 * Loads what the detail of an asset of the type `assetType` reads of the ext system `extSystem` as it draws, and throws
 * without: the configuration of the ext system and the custom fields of its assets, each one the DAM configuration
 * store of `configName` has not got yet. Of the custom fields, every type where the store has none of the ext system,
 * else the type `assetType` alone where its read failed before. A load that fails, or leaves that type not loaded,
 * rejects with an `AnzuFatalError`, which the alerts say as an unknown error: the loaders reject with `false`, which
 * they do not say.
 */
export async function loadAssetDetailExtSystem(
  client: () => AxiosInstance,
  extSystem: IntegerId,
  assetType: DamAssetTypeType,
  configName: string
) {
  const {
    getDamConfigExtSystem,
    loadDamConfigExtSystem,
    getDamConfigAssetCustomFormElements,
    loadDamConfigAssetCustomFormElements,
  } = useDamConfigState(client, configName)
  const loads: Promise<unknown>[] = []
  if (isUndefined(getDamConfigExtSystem(extSystem))) loads.push(loadDamConfigExtSystem(extSystem))
  if (isUndefined(getDamConfigAssetCustomFormElements(extSystem, assetType))) {
    loads.push(
      loadDamConfigAssetCustomFormElements(
        extSystem,
        getDamConfigAssetCustomFormElements(extSystem) ? [assetType] : undefined
      )
    )
  }
  const failed = () =>
    new AnzuFatalError(undefined, `The configuration of the ext system ${extSystem} could not be loaded.`)
  try {
    await Promise.all(loads)
  } catch {
    throw failed()
  }
  if (isUndefined(getDamConfigAssetCustomFormElements(extSystem, assetType))) throw failed()
}
