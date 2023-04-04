<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import type { ColumnInternalValues } from '@/composables/system/datatableColumns'
import { cloneDeep } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    columnsAll: ColumnInternalValues[]
    columnsHidden: Array<string>
    buttonT?: string
    buttonClass?: string
    dataCy?: string
  }>(),
  {
    buttonT: 'common.system.datatable.config',
    buttonClass: 'ml-1',
    dataCy: 'table-settings',
  }
)
const emit = defineEmits<{
  (e: 'update:columnsHidden', data: Array<string>): void
}>()

const { t } = useI18n()

const isVisible = (key: string) => {
  return !props.columnsHidden.includes(key)
}

const toggleVisibility = (key: string) => {
  const cloned = cloneDeep(props.columnsHidden)
  const index = cloned.indexOf(key)
  if (index > -1) {
    cloned.splice(index, 1)
    emit('update:columnsHidden', cloned)
    return
  }
  cloned.push(key)
  emit('update:columnsHidden', cloned)
}
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    color="light"
    icon
    size="x-small"
    variant="text"
  >
    <VIcon icon="mdi-cog" />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t(buttonT) }}
    </VTooltip>
    <VMenu activator="parent">
      <VCard>
        <VList density="compact">
          <VListItem>
            <VListItemTitle>
              <strong>{{ t('common.system.datatable.displayCols') }}</strong>
            </VListItemTitle>
          </VListItem>
          <VListItem
            v-for="column in columnsAll"
            :key="column.key"
            @click.stop="toggleVisibility(column.key)"
          >
            <VListItemTitle>
              <VIcon
                v-if="isVisible(column.key)"
                class="mr-2"
                icon="mdi-checkbox-marked"
              />
              <VIcon
                v-else
                class="mr-2"
                icon="mdi-checkbox-blank-outline"
              />
              {{ column.title }}
            </VListItemTitle>
          </VListItem>
        </VList>
      </VCard>
    </VMenu>
  </VBtn>
</template>
