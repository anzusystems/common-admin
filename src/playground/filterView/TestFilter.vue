<script lang="ts" setup>
import { ref } from 'vue'
import { useTestListFilter } from '@/playground/filterView/testFilter'
import AFilterWrapper from '@/components/filter/AFilterWrapper.vue'
import AFilterInteger from '@/components/filter/AFilterInteger.vue'
import AFilterString from '@/components/filter/AFilterString.vue'
import AFilterMixed from '@/components/filter/AFilterMixed.vue'
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
      :touched="touched"
      enable-advanced
      @reset-filter="resetFilter"
    >
      <VRow align="start">
        <VCol
          cols="12"
          sm="12"
        >
          <AFilterMixed
            :filter-id="filter.id"
            :filter-doc-id="filter.docId"
            :filter-url="filter.url"
            :filter-text="filter.text"
            :filter-overrides="[filter.text, filter.title]"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <VCol
          cols="12"
          sm="2"
        >
          <AFilterInteger
            v-model="filter.id"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <VCol
          cols="12"
          sm="5"
        >
          <AFilterString
            v-model="filter.text"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <VCol cols="6">
          <AFilterDatetimePicker
            v-model="filter.publishedAtFrom"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <VCol cols="6">
          <AFilterDatetimePicker
            v-model="filter.publishedAtUntil"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
      </VRow>
      <template #advanced>
        <VRow align="start">
          <VCol
            cols="12"
            sm="12"
          >
            <AFilterMixed
              :filter-id="filter.id"
              :filter-doc-id="filter.docId"
              :filter-url="filter.url"
              :filter-text="filter.text"
              :filter-overrides="[filter.text, filter.title]"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol
            cols="12"
            sm="2"
          >
            <AFilterInteger
              v-model="filter.id"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol
            cols="12"
            sm="5"
          >
            <AFilterString
              v-model="filter.text"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
        </VRow>
      </template>
    </AFilterWrapper>
  </VForm>
</template>
