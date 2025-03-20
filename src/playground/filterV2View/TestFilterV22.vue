<script lang="ts" setup>
import { ref } from 'vue'
import { useTestListFilter } from '@/playground/filterV2View/testFilterV22'
import AFilterWrapper from '@/components/filter2/AFilterWrapper.vue'
import AFilterString from '@/components/filter2/variant/AFilterString.vue'
import AFilterValueObjectOptionsSelect from '@/components/filter2/variant/AFilterValueObjectOptionsSelect.vue'
import { useSubjectStatus } from '@/playground/filterV2View/testFilterV2.ts'

const emit = defineEmits<{
  (e: 'submitFilter'): void
  (e: 'resetFilter'): void
}>()

const { filterConfigSubject, filterDataSubject } = useTestListFilter()
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

const { subjectStatusOptions } = useSubjectStatus()
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
        <VCol cols="3">
          <AFilterString
            v-model="filterDataSubject.text"
            :config="filterConfigSubject.fields.text"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
      </VRow>
      <template #advanced>
        <VRow>
          <VCol cols="2">
            <AFilterValueObjectOptionsSelect
              v-model="filterDataSubject.status"
              :config="filterConfigSubject.fields.status"
              :items="subjectStatusOptions"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
        </VRow>
      </template>
    </AFilterWrapper>
  </VForm>
</template>
