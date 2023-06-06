<script lang="ts" setup>
import { ref } from 'vue'
import { useDemoListFilter } from './viewsDemoData'
import { useLogLevel } from '../../../src/model/valueObject/LogLevel'
import AFilterWrapper from '@/components/filter/AFilterWrapper.vue'
import AFilterString from '@/components/filter/AFilterString.vue'
import AFilterDatetimePicker from '@/components/filter/AFilterDatetimePicker.vue'
import AFilterValueObjectOptionsSelect from '@/components/filter/AFilterValueObjectOptionsSelect.vue'

const emit = defineEmits<{
  (e: 'submitFilter'): void
  (e: 'resetFilter'): void
}>()

const filter = useDemoListFilter()
const touched = ref(false)

const submitFilter = () => {
  touched.value = false
  emit('submitFilter')
}

const resetFilter = () => {
  touched.value = false
  emit('resetFilter')
}

const onAnyFilterUpdate = () => {
  touched.value = true
}

const { logLevelOptions } = useLogLevel()
</script>

<template>
  <VForm
    name="search"
    @submit.prevent="submitFilter"
  >
    <AFilterWrapper
      :touched="touched"
      enable-advanced
      @reset-filter="resetFilter"
    >
      <VRow align="start">
        <VCol
          class="pb-0"
          cols="6"
        >
          <AFilterValueObjectOptionsSelect
            v-model="filter.levelName"
            :items="logLevelOptions"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <VCol cols="6">
          <AFilterString
            v-model="filter.contextId"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>

      </VRow>
      <template #advanced>
        <VRow align="start">
          <VCol cols="6">
            <AFilterDatetimePicker
              v-model="filter.datetimeFrom"
              disable-clearable
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="6">
            <AFilterDatetimePicker
              v-model="filter.datetimeTo"
              disable-clearable
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
        </VRow>
      </template>
    </AFilterWrapper>
  </VForm>
</template>
