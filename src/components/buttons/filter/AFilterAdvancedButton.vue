<script lang="ts" setup>
import { computed, ref } from 'vue'
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    tooltipT?: string
    buttonClass?: string
    dataCy?: string
  }>(),
  {
    tooltipT: 'common.button.advancedFilters',
    buttonClass: 'mt-1',
    dataCy: 'filter-advanced',
  }
)
const emit = defineEmits<{
  (e: 'advancedFilter'): void
}>()

const active = ref(false)

const onClick = (event: Event) => {
  eventClickBlur(event)
  active.value = !active.value
  emit('advancedFilter')
}

const icon = computed(() => {
  return active.value ? 'mdi-chevron-double-up' : 'mdi-chevron-double-down'
})

const { t } = useI18n()
</script>

<template>
  <VBtn :class="buttonClass" :data-cy="dataCy" icon size="x-small" variant="text" @click.stop="onClick">
    <VIcon :icon="icon" />
    <VTooltip activator="parent" location="bottom">{{ t(tooltipT) }}</VTooltip>
  </VBtn>
</template>
