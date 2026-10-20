import { ref } from 'vue'
import { isNull } from '@/shared/utils/common'
import { useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'
import { inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'

// The last size of each DAM configuration: one upload hands it to the next one of its name.
const chunkSizes = new Map<string, number>()

/**
 * The size of the next chunk of an upload under the DAM configuration `configName`, bounded by its prv configuration.
 * A name left out is the inherited one in a component's setup, else `default`.
 */
export function useDamUploadChunkSize(apiTimeout: number = 30, configName?: string) {
  const name = inheritedDamConfigName(configName)
  const damConfigStore = useDamConfigStoreOf(name)
  const lastChunkSize = ref(chunkSizes.get(name) || damConfigStore.damPrvConfig.settings.imageChunkConfig.minSize)

  const minUploadTimeThreshold = apiTimeout / 5
  const idealUploadTimeThreshold = apiTimeout / 4
  const maxUploadTimeThreshold = apiTimeout / 2

  const updateChunkSize = (speed: number | null) => {
    if (isNull(speed)) {
      return false
    }

    const expectedChunkUploadSpeed = lastChunkSize.value / speed
    if (expectedChunkUploadSpeed > maxUploadTimeThreshold) {
      return resize(maxUploadTimeThreshold * speed)
    }
    if (expectedChunkUploadSpeed < minUploadTimeThreshold) {
      return resize(idealUploadTimeThreshold * speed)
    }

    return false
  }

  // Answers whether the size changed: at a bound of the configuration it stays, and the chunk of a retry is not read
  // from the file again.
  const resize = (size: number) => {
    const next = returnFromRange(size)
    const changed = next !== lastChunkSize.value
    lastChunkSize.value = next
    chunkSizes.set(name, next)

    return changed
  }

  const returnFromRange = (value: number) => {
    if (value > damConfigStore.damPrvConfig.settings.imageChunkConfig.maxSize) {
      return damConfigStore.damPrvConfig.settings.imageChunkConfig.maxSize
    }
    if (value < damConfigStore.damPrvConfig.settings.imageChunkConfig.minSize) {
      return damConfigStore.damPrvConfig.settings.imageChunkConfig.minSize
    }

    return value
  }

  return {
    lastChunkSize,
    updateChunkSize,
  }
}
