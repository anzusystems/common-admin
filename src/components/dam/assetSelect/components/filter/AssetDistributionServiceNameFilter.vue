<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import AFilterValueObjectOptionsSelect from '@/labs/filters/AFilterValueObjectOptionsSelect.vue'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'
import type { IntegerId } from '@/types/common'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'

const props = withDefaults(
  defineProps<{
    name: string
    licenceId: IntegerId
    configName?: string
  }>(),
  {
    configName: 'default',
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const status = ref<'loading' | 'ready' | 'error'>('loading')

const damConfigStore = useDamConfigStore()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient } = useCommonAdminCoreDamOptions(props.configName)
const { loadDamPrvConfig } = useDamConfigState(damClient)

const items = computed(() => {
  return Object.entries(damConfigStore.damPrvConfig.distributionServices).map(([key, value]) => {
    return {
      title: value.title,
      value: key,
    }
  })
})

onMounted(async () => {
  const promises: Promise<any>[] = []
  if (!damConfigStore.initialized.damPrvConfig) {
    promises.push(loadDamPrvConfig())
  }
  try {
    await Promise.allSettled(promises)
  } catch (e) {
    status.value = 'error'
  }
  if (status.value !== 'error') status.value = 'ready'
})
</script>

<template>
  <div
    v-if="status === 'loading'"
    class="d-flex w-100 align-center justify-center"
  >
    <VProgressCircular indeterminate />
  </div>
  <div
    v-else-if="status === 'error'"
  >
    Error loading distribution services.
  </div>
  <AFilterValueObjectOptionsSelect
    v-else
    :name="name"
    :items="items"
    @change="emit('change')"
  />
</template>
