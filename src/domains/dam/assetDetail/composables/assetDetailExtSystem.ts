import type { AxiosInstance } from 'axios'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import type { DamAssetTypeType } from '@/domains/dam/types/Asset'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

/**
 * Loads what the asset detail of type `assetType` needs from ext system `extSystem` and would otherwise throw on.
 * Loads the ext system config and the custom fields missing in the `configName` store.
 * Custom fields: all types if the store has none for the ext system, else only `assetType` if its read failed before.
 * Rejects with `AnzuFatalError` on failure or if the type stays unloaded. Alerts show
 * it as an unknown error. The loaders reject with `false`, which alerts do not show.
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
