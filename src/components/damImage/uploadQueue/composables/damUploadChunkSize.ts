import { ref } from 'vue'
import { isNull } from '@/utils/common'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'

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
      lastChunkSize.value = returnFromRange(maxUploadTimeThreshold * speed)
      chunkSize.value = lastChunkSize.value

      return true
    }
    if (expectedChunkUploadSpeed < minUploadTimeThreshold) {
      lastChunkSize.value = returnFromRange(idealUploadTimeThreshold * speed)
      chunkSize.value = lastChunkSize.value

      return true
    }

    return false
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
