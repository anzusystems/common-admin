<script lang="ts" setup>
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'
import FilterBookmarkDialog from '@/components/filter2/FilterBookmarkDialog.vue'

withDefaults(
  defineProps<{
    tooltipT?: string
    buttonClass?: string
    dataCy?: string
  }>(),
  {
    tooltipT: 'common.button.bookmarkFilter',
    buttonClass: 'ml-2',
    dataCy: 'filter-bookmark',
  }
)

const dialog = defineModel<boolean>('dialog', { default: false, required: false })

const onClick = (event: Event) => {
  eventClickBlur(event)
  dialog.value = true
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
      icon="mdi-bookmark-outline"
    />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t(tooltipT) }}
    </VTooltip>
  </VBtn>
  <FilterBookmarkDialog
    v-if="dialog"
    @on-close="dialog = false"
  />
</template>
