<script lang="ts" setup>
import type { IntegerId } from '@/types/common'
import { onMounted, ref } from 'vue'
import { useDamConfigState } from '@/components/dam/uploadQueue/damConfigState'
import { useCoreDamOptions } from '@/components/dam/assetSelect/composables/coreDamOptions'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
    configName?: string
  }>(),
  {
    configName: 'default',
  }
)

const ready = ref(false)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient } = useCoreDamOptions(props.configName)
const { initialized, loadDamConfigExtSystem } = useDamConfigState(damClient)

onMounted(async () => {
  if (initialized.damConfigExtSystem !== props.extSystem) {
    await loadDamConfigExtSystem(props.extSystem)
  }
  ready.value = true
})
</script>

<template>
  <slot v-if="ready" />
</template>
