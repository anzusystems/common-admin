import { ref } from 'vue'
import { isNull } from '@/shared/utils/common'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'

const chunkSize = ref<number | undefined>(undefined)

export function useDamUploadChunkSize(apiTimeout: number = 30) {
  const damConfigStore = useDamConfigStore()
  const lastChunkSize = ref(chunkSize.value || damConfigStore.damPrvConfig.settings.imageChunkConfig.minSize)

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
    chunkSize.value = next

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
