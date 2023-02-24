<script lang="ts" setup>
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'
import AIconGroup from '@/components/AIconGroup.vue'

withDefaults(
  defineProps<{
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    loading?: boolean
    disabled?: boolean
  }>(),
  {
    buttonT: 'common.button.saveAndClose',
    buttonClass: 'ml-2',
    dataCy: 'button-save-close',
    loading: undefined,
    disabled: undefined,
  }
)
const emit = defineEmits<{
  (e: 'saveRecordAndClose'): void
}>()

const onClick = (event: Event) => {
  eventClickBlur(event)
  emit('saveRecordAndClose')
}

const { t } = useI18n()
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    :loading="loading"
    :disabled="disabled"
    color="primary"
    icon=""
    variant="outlined"
    :width="36"
    :height="35"
    @click.stop="onClick"
  >
    <AIconGroup main-icon="mdi-content-save" secondary-icon="mdi-close" />
    <VTooltip activator="parent" location="bottom">{{ t(buttonT) }}</VTooltip>
  </VBtn>
</template>
