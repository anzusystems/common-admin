<script lang="ts" setup>
import { provide, ref } from 'vue'
import { useTestListFilter } from '@/playground/filterV2View/testFilterV22'
import AFilterWrapper from '@/components/filter2/AFilterWrapper.vue'
import AFilterString from '@/components/filter2/variant/AFilterString.vue'
import AFilterValueObjectOptionsSelect from '@/components/filter2/variant/AFilterValueObjectOptionsSelect.vue'
import { useSubjectStatus } from '@/playground/filterV2View/testFilterV2.ts'
import { FilterConfigKey, FilterDataKey } from '@/components/filter2/filterInjectionKeys.ts'

const emit = defineEmits<{
  (e: 'afterReset'): void
  (e: 'afterSubmit'): void
}>()

const { filterConfigSubject, filterDataSubject } = useTestListFilter()
provide(FilterConfigKey, filterConfigSubject)
provide(FilterDataKey, filterDataSubject)

const touched = ref(false)

const submitFilter = () => {
  touched.value = false
  emit('afterSubmit')
}

const resetFilter = () => {
  touched.value = false
  emit('afterReset')
}

const onAnyFilterUpdate = () => {
  touched.value = true
}

const { subjectStatusOptions } = useSubjectStatus()
</script>

<template>
  {{ filterDataSubject }}<br><br>
  {{ filterConfigSubject }}
  <VForm
    name="search"
    @submit.prevent="submitFilter"
  >
    <AFilterWrapper
      :touched="touched"
      @submit-filter="submitFilter"
      @reset-filter="resetFilter"
    >
      <template #search>
        <AFilterString
          v-model="filterDataSubject.text"
          :config="filterConfigSubject.fields.text"
          @update:model-value="onAnyFilterUpdate"
        />
      </template>
      <template #detail>
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
