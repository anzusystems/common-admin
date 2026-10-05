<script setup lang="ts">
import { type Component, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { loadDamAssetImageRoiSelect } from '@/domains/dam/cropper/utils/damAssetImageRoiSelectLoader'
import type { IntegerId } from '@/shared/types/common'

withDefaults(
  defineProps<{
    extSystem: IntegerId
    configName?: string
    readonly?: boolean
  }>(),
  {
    configName: 'default',
    readonly: false,
  }
)

const { t } = useI18n()

const roiSelect = shallowRef<Component>()
const loadFailed = ref(false)

const load = async () => {
  loadFailed.value = false
  try {
    roiSelect.value = await loadDamAssetImageRoiSelect()
  } catch {
    loadFailed.value = true
  }
}

onMounted(load)
</script>

<template>
  <component
    :is="roiSelect"
    v-if="roiSelect"
    :ext-system="extSystem"
    :config-name="configName"
    :readonly="readonly"
  />
  <div
    v-else-if="loadFailed"
    class="d-flex align-center ga-2"
  >
    <span class="text-error">{{ t('common.alert.unknownError') }}</span>
    <ABtnTertiary
      data-cy="button-retry-roi-select"
      @click.stop="load"
    >
      {{ t('common.button.retry') }}
    </ABtnTertiary>
  </div>
  <VProgressCircular
    v-else
    indeterminate
    color="primary"
  />
</template>
