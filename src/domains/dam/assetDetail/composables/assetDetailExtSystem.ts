import type { AxiosInstance } from 'axios'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

/**
 * Loads what the detail of an asset reads of the ext system `extSystem` as it draws, and throws without: the
 * configuration of the ext system and the custom fields of its assets, each one the DAM configuration store of
 * `configName` has not got yet. A load that fails rejects with an `AnzuFatalError`, which the alerts say as an unknown
 * error: the loaders reject with `false`, which they do not say.
 */
export async function loadAssetDetailExtSystem(client: () => AxiosInstance, extSystem: IntegerId, configName: string) {
  const {
    getDamConfigExtSystem,
    loadDamConfigExtSystem,
    getDamConfigAssetCustomFormElements,
    loadDamConfigAssetCustomFormElements,
  } = useDamConfigState(client, configName)
  const loads: Promise<unknown>[] = []
  if (isUndefined(getDamConfigExtSystem(extSystem))) loads.push(loadDamConfigExtSystem(extSystem))
  if (isUndefined(getDamConfigAssetCustomFormElements(extSystem))) {
    loads.push(loadDamConfigAssetCustomFormElements(extSystem))
  }
  try {
    await Promise.all(loads)
  } catch {
    throw new AnzuFatalError(undefined, `The configuration of the ext system ${extSystem} could not be loaded.`)
  }
}
