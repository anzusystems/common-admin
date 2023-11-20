import { ref } from 'vue'
import { useDamConfigState } from '@/components/dam/uploadQueue/damConfigState'
import { isNull } from '@/utils/common'

const chunkSize = ref<number | undefined>(undefined)

export function useDamUploadChunkSize(apiTimeout: number = 30) {
  const { damPrvConfig } = useDamConfigState()
  const lastChunkSize = ref(chunkSize.value || damPrvConfig.value.settings.imageChunkConfig.minSize)

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
    if (value > damPrvConfig.value.settings.imageChunkConfig.maxSize) {
      return damPrvConfig.value.settings.imageChunkConfig.maxSize
    }
    if (value < damPrvConfig.value.settings.imageChunkConfig.minSize) {
      return damPrvConfig.value.settings.imageChunkConfig.minSize
    }

    return value
  }

  return {
    lastChunkSize,
    updateChunkSize,
  }
}
