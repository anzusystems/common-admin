<script lang="ts" setup>
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    tooltipT?: string
    buttonClass?: string
    dataCy?: string
  }>(),
  {
    tooltipT: 'common.button.resetFilter',
    buttonClass: 'ml-2',
    dataCy: 'filter-reset',
  }
)
const emit = defineEmits<{
  (e: 'reset'): void
}>()

const onClick = (event: Event) => {
  eventClickBlur(event)
  emit('reset')
}

const { t } = useI18n()
</script>

<template>
  <VBtn
    :class="buttonClass"
    class="px-2"
    :data-cy="dataCy"
    color="light"
    min-width="36px"
    variant="flat"
    @click.stop="onClick"
  >
    <VIcon
      color="grey darken-1"
      icon="mdi-filter-remove-outline"
    />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t(tooltipT) }}
    </VTooltip>
  </VBtn>
</template>
