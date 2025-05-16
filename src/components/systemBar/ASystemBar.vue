<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import ASystemBarNewVersion from '@/components/systemBar/ASystemBarNewVersion.vue'
import { isUndefined } from '@/utils/common'
import { AnzuNewVersionFetchError, isAnzuNewVersionFetchError } from '@/model/error/AnzuNewVersionFetchError'
import { useUserActivity } from '@/composables/useUserActivity.ts'

const props = withDefaults(
  defineProps<{
    currentVersion: string
    checkInterval?: number
    jsonRelativePath?: string
    minInactiveTime?: number // New prop for minimum inactive time before check
  }>(),
  {
    checkInterval: 60000,
    jsonRelativePath: 'config.json',
    minInactiveTime: 5000, // 5 seconds default
  }
)

const showSystemBar = ref<boolean>(false)
const abortController = ref<AbortController | null>(null)
const lastInactiveTime = ref<number>(0)

const checkNewVersion = async (): Promise<void> => {
  if (abortController.value) {
    abortController.value.abort()
  }

  abortController.value = new AbortController()

  const isAbortError = (error: unknown): error is Error => {
    return error instanceof Error && error.name === 'AbortError'
  }

  try {
    const res = await fetch(`/${props.jsonRelativePath}?random=${Date.now()}`, {
      signal: abortController.value.signal,
    })
    if (res.ok) {
      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new AnzuNewVersionFetchError('Unable to load env config. Incorrect content type.')
      }
      const json = await res.json()
      if (Object.keys(json).length < 1) {
        throw new AnzuNewVersionFetchError('Unable to load env config. Incorrect response body.')
      }
      showSystemBar.value = !isUndefined(json.appVersion) && json.appVersion !== props.currentVersion

      return
    }
    throw new AnzuNewVersionFetchError('Unable to load env config. Incorrect response code.')
  } catch (error) {
    if (isAbortError(error)) {
      return
    }
    if (isAnzuNewVersionFetchError(error)) {
      throw error
    }
    if (error instanceof SyntaxError) {
      throw new AnzuNewVersionFetchError('Unable to load env config. Syntax error.', error)
    }
    throw new AnzuNewVersionFetchError('Unable to load env config. Unknown error.', error as any)
  }
}

const systemBarComponent = computed(() => {
  return ASystemBarNewVersion
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { pause, resume } = useIntervalFn(() => {
  checkNewVersion()
}, props.checkInterval)

const { isWindowActive } = useUserActivity()

watch(
  isWindowActive,
  (newValue: boolean) => {
    const now: number = Date.now()

    if (newValue) {
      const inactiveDuration: number = now - lastInactiveTime.value
      resume()
      if (inactiveDuration > props.minInactiveTime) {
        checkNewVersion()
      }
    } else {
      lastInactiveTime.value = now
      pause()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (abortController.value) {
    abortController.value.abort()
  }
})
</script>

<template>
  <VAppBar
    v-if="showSystemBar"
    height="48"
    color="orange accent-3"
    elevation="0"
    :order="-1"
  >
    <div class="text-center w-100 text-caption pb-1">
      <component :is="systemBarComponent" />
    </div>
  </VAppBar>
</template>
