<script lang="ts" setup>
import { computed, inject, toRaw } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
} from '@/labs/filters/filterInjectionKeys'
import { isArray, isBoolean, isNumber, isString, isUndefined } from '@/utils/common'
import { useI18n } from 'vue-i18n'
import type { AllowedFilterValues } from '@/labs/filters/filterFactory'

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

const isClosable = (name: string) => {
  const config =  filterConfig.fields[name]
  return !config.mandatory && config.clearable
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

const clickClose = (name: string, optionValue: number | string) => {
  // update selected
  const config =  filterConfig.fields[name]
  const selectedFound = filterSelected.value.get(name)
  if (config.mandatory) {
    return
  } else if (selectedFound && selectedFound.length === 1) {
    filterSelected.value.delete(name)
  } else if (selectedFound) {
    const foundIndex = selectedFound.findIndex((item) => item.value === optionValue)
    selectedFound.splice(foundIndex, 1)
  }
  // update data
  if (config.type === 'timeInterval' && config.related) {
    filterData[name] = config.default
    filterData[config.related] = filterConfig.fields[config.related].default
  } else if (isArray(filterData[name]) && filterData[name].length > 0) {
    const foundIndex = filterData[name].findIndex((item) => item === optionValue)
    const newArray = [...toRaw(filterData[name])]
    newArray.splice(foundIndex, 1)
    filterData[name] = newArray as AllowedFilterValues
  } else if (isString(filterData[name]) || isNumber(filterData[name])) {
    filterData[name] = config.default
  } else if (isBoolean(filterData[name])) {
    filterData[name] = config.default
  }
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
        :closable="isClosable(item.name)"
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
