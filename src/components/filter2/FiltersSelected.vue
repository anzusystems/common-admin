<script lang="ts" setup>
import { computed, inject, toRaw, toValue } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedFutureKey,
  FilterSelectedKey,
  FilterTouchedKey,
} from '@/components/filter2/filterInjectionKeys'
import { isArray, isBoolean, isNumber, isString, isUndefined } from '@/utils/common'
import { useI18n } from 'vue-i18n'

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
const filterSelected = inject(FilterSelectedKey)
const filterSelectedFuture = inject(FilterSelectedFutureKey)
const touched = inject(FilterTouchedKey)

if (
  isUndefined(filterConfig) ||
  isUndefined(filterData) ||
  isUndefined(filterSelected) ||
  isUndefined(filterSelectedFuture) ||
  isUndefined(touched)
) {
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

const clickClose = (name: string, optionValue: number | string) => {
  console.log('close', name, optionValue)
  // update selected
  const selectedFound = filterSelected.value.get(name)
  if (selectedFound && selectedFound.length === 1) {
    filterSelected.value.delete(name)
  } else if (selectedFound) {
    const foundIndex = selectedFound.findIndex((item) => item.value === optionValue)
    selectedFound.splice(foundIndex, 1)
  }
  // update future selected
  const selectedFutureFound = filterSelectedFuture.value.get(name)
  if (selectedFutureFound && selectedFutureFound.length === 1) {
    filterSelectedFuture.value.delete(name)
  } else if (selectedFutureFound) {
    const foundIndex = selectedFutureFound.findIndex((item) => item.value === optionValue)
    selectedFutureFound.splice(foundIndex, 1)
  }
  // update data
  if (isArray(filterData[name]) && filterData[name].length > 0) {
    console.log(toRaw(filterData[name]))
    const foundIndex = filterData[name].findIndex((item) => item === optionValue)
    const newArray = [...toRaw(filterData[name])]
    newArray.splice(foundIndex, 1)
    filterData[name] = newArray
  } else if (isString(filterData[name]) || isNumber(filterData[name])) {
    filterData[name] = filterConfig.fields[name].default
  } else if (isBoolean(filterData[name])) {
    filterData[name] = filterConfig.fields[name].default
  }
  touched.value = true
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
