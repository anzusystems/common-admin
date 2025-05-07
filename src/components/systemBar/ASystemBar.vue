<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import ASystemBarNewVersion from '@/components/systemBar/ASystemBarNewVersion.vue'
import { isUndefined } from '@/utils/common'
import { AnzuNewVersionFetchError } from '@/model/error/AnzuNewVersionFetchError'

const props = withDefaults(
  defineProps<{
    currentVersion: string
    checkInterval?: number
    jsonRelativePath?: string
  }>(),
  {
    checkInterval: 60000,
    jsonRelativePath: 'config.json',
  }
)

const showSystemBar = ref(false)
const abortController = ref<AbortController | null>(null)

const checkNewVersion = async () => {
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

    if (error instanceof AnzuNewVersionFetchError) {
      console.log(error.message)
      return
    }
    if (error instanceof SyntaxError) {
      console.log('There was a SyntaxError', error)
      return
    }
    console.log('There was an error in new version fetch', error)
  }
}

const systemBarComponent = computed(() => {
  return ASystemBarNewVersion
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
useIntervalFn(() => {
  checkNewVersion()
}, props.checkInterval)

const visibility = useDocumentVisibility()
watch(visibility, (newValue) => {
  if (newValue === 'visible') {
    checkNewVersion()
  }
})

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
