<script setup lang="ts">
import { inject } from 'vue'
import { FilterConfigKey } from '@/components/filter2/filterInjectionKeys.ts'
import { isUndefined } from '@/utils/common.ts'
import AFilterFormItem from '@/components/filter2/AFilterFormItem.vue'
import { datatableSlotName } from '@/components/datatable/datatable.ts'

const filterConfig = inject(FilterConfigKey)

if (isUndefined(filterConfig)) {
  throw new Error('Incorrect provide/inject config.')
}
</script>

<template>
  <VRow>
    <VCol
      v-for="field in filterConfig.fields"
      :key="field.name"
      :cols="field.render.xs"
      :sm="field.render.sm"
      :md="field.render.md"
      :lg="field.render.lg"
      :xl="field.render.xl"
      :class="{ 'd-none': field.render.skip }"
    >
      <slot
        :name="datatableSlotName(field.name)"
        :item-config="field"
      >
        <AFilterFormItem :name="field.name" />
      </slot>
    </VCol>
  </VRow>
</template>
