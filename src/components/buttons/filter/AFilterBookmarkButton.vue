<script lang="ts" setup>
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'
import FilterBookmarkDialog from '@/labs/filters/FilterBookmarkDialog.vue'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import type { DatatableSortBy } from '@/composables/system/datatableColumns'

withDefaults(
  defineProps<{
    client: () => AxiosInstance
    system: string
    user: IntegerId
    systemResource: string
    tooltipT?: string
    buttonClass?: string
    dataCy?: string
    datatableHiddenColumns?: string[] | undefined
    datatableSortBy?: DatatableSortBy
  }>(),
  {
    tooltipT: 'common.button.bookmarkFilter',
    buttonClass: 'ml-2',
    dataCy: 'filter-bookmark',
    datatableHiddenColumns: undefined,
    datatableSortBy: undefined,
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
    :client="client"
    :system="system"
    :user="user"
    :system-resource="systemResource"
    :datatable-hidden-columns="datatableHiddenColumns"
    @on-close="dialog = false"
  />
</template>
