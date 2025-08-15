<script lang="ts" setup>
import { computed, inject } from 'vue'
import { FilterConfigKey, FilterDataKey, FilterSelectedKey } from '@/labs/filters/filterInjectionKeys'
import { isUndefined } from '@/utils/common'
import { useI18n } from 'vue-i18n'
import { useFilterClearHelpers } from '@/labs/filters/filterFactory'

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
const filterSelected = inject(FilterSelectedKey)

if (isUndefined(filterConfig) || isUndefined(filterData) || isUndefined(filterSelected)) {
  throw new Error('Incorrect provide/inject config.')
}

const { t } = useI18n()

const getTitleFromConfig = (name: string) => {
  const titleT = filterConfig.fields?.[name]?.titleT
  if (titleT) return t(titleT)
  return name
}

const selectedArray = computed(() => {
  const fieldOrder = Object.keys(filterConfig.fields)
  return Array.from(filterSelected.value)
    .map(([key, valueArray]) => ({
      name: key,
      title: getTitleFromConfig(key),
      options: valueArray,
    }))
    .sort((a, b) => fieldOrder.indexOf(a.name) - fieldOrder.indexOf(b.name))
})

const { clearOneFilterSelected, isClearable } = useFilterClearHelpers()

const clickClose = (name: string, optionValue: number | string) => {
  clearOneFilterSelected(name, optionValue, filterData, filterConfig, filterSelected)
  filterConfig.touched = true
}
</script>

<template>
  <div
    v-for="item in selectedArray"
    :key="item.name"
    class="a-selected-filters"
  >
    <div class="a-selected-filters__label text-caption">
      {{ item.title }}:
    </div>
    <div
      v-for="option in item.options"
      :key="option.value"
      class="a-selected-filters__chips"
    >
      <VChip
        v-if="isClearable(item.name, filterConfig)"
        closable
        size="small"
        class="a-selected-filters__chip"
        @click:close.stop="clickClose(item.name, option.value)"
      >
        <template #close>
          <VIcon
            size="16"
            icon="mdi-close-circle"
          />
        </template>
        {{ option.title }}
      </VChip>
      <VChip
        v-else
        size="small"
        class="a-selected-filters__chip"
      >
        {{ option.title }}
      </VChip>
    </div>
  </div>
</template>

<style lang="scss">
.a-selected-filters {
  display: inline-flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 20px;
  padding: 4px 4px 4px 12px;
  margin: 0 4px 2px 0;
  gap: 8px;
  max-width: 100%;

  &__label {
    white-space: nowrap;
  }

  &__chips {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  &__chip {
    background: white;
    box-shadow: none;

    .v-chip__content {
      max-width: 40vw;
    }

    &:hover .v-chip__close {
      opacity: 0.8;
    }
  }

  .v-chip__close {
    opacity: 0.3;
    transition: opacity 0.2s;
  }
}
</style>
