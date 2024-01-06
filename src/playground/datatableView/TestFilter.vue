<script lang="ts" setup>
import { ref } from 'vue'
import { useTestListFilter } from '@/playground/datatableView/testFilter'
import AFilterWrapper from '@/components/filter/AFilterWrapper.vue'
import AFilterString from '@/components/filter/AFilterString.vue'
import AFilterDatetimePicker from '@/components/filter/AFilterDatetimePicker.vue'

const emit = defineEmits<{
  (e: 'submitFilter'): void
  (e: 'resetFilter'): void
}>()

const filter = useTestListFilter()
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
</script>

<template>
  <VForm
    name="search"
    @submit.prevent="submitFilter"
  >
    <AFilterWrapper
      enable-advanced
      :touched="touched"
      @reset-filter="resetFilter"
    >
      <VRow align="start">
        <VCol cols="4">
          <AFilterString
            v-model="filter.id"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <VCol cols="4">
          <AFilterString
            v-model="filter.docId"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <VCol cols="4">
          <AFilterString
            v-model="filter.text"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
      </VRow>
      <template #advanced>
        <VRow>
          <VCol cols="6">
            <AFilterDatetimePicker
              v-model="filter.modifiedAtFrom"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="6">
            <AFilterDatetimePicker
              v-model="filter.modifiedAtUntil"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
        </VRow>
      </template>
    </AFilterWrapper>
  </VForm>
</template>
