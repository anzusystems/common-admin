<script lang="ts" setup>
import { ref } from 'vue'
import { useDemoListFilter, useLogSystem, useLogType } from './viewsDemoData'
import { useLogLevel } from '../../../src/model/valueObject/LogLevel'
import AFilterWrapper from '@/components/filter/AFilterWrapper.vue'
import AFilterString from '@/components/filter/AFilterString.vue'
import AFilterInteger from '@/components/filter/AFilterInteger.vue'
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

const { logTypeOptions } = useLogType()
const { logLevelOptions } = useLogLevel()
const { logSystemOptions } = useLogSystem()
</script>

<template>
  <VForm
    name="search"
    @submit.prevent="submitFilter"
  >
    <AFilterWrapper
      :touched="touched"
      enable-advanced
      enable-top
      @reset-filter="resetFilter"
    >
      <VRow align="start">
        <VCol
          class="pb-0"
          cols="4"
        >
          <AFilterValueObjectOptionsSelect
            v-model="filter.levelName"
            :items="logLevelOptions"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <VCol cols="2">
          <AFilterString
            v-model="filter.contextId"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <VCol cols="3">
          <AFilterDatetimePicker
            v-model="filter.datetimeFrom"
            disable-clearable
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <VCol cols="3">
          <AFilterDatetimePicker
            v-model="filter.datetimeTo"
            disable-clearable
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
      </VRow>
      <template #top>
        <VRow align="start">
          <VCol
            class="pb-0"
            cols="8"
          >
            <AFilterValueObjectOptionsSelect
              v-model="filter.system"
              :items="logSystemOptions"
            />
          </VCol>
          <VCol
            class="pb-0"
            cols="4"
          >
            <AFilterValueObjectOptionsSelect
              v-model="filter.type"
              :items="logTypeOptions"
            />
          </VCol>
        </VRow>
        <VDivider class="mb-4" />
      </template>
      <template #advanced>
        <VRow align="start">
          <VCol cols="2">
            <AFilterString
              v-model="filter.id"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="6">
            <AFilterString
              v-model="filter.message"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="2">
            <AFilterString
              v-model="filter.appVersion"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="2">
            <AFilterInteger
              v-model="filter.userId"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
        </VRow>
      </template>
    </AFilterWrapper>
  </VForm>
</template>
