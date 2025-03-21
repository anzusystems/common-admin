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
        <VCol
          cols="12"
          sm="6"
          md="4"
        >
          <AFilterString
            v-model="filterDataSubject.text"
            :config="filterConfigSubject.fields.text"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <VCol
          cols="auto"
          class="flex-grow-1"
        >
          <div class="chip-group">
            <div class="group-label text-caption">
              Stav:
            </div>
            <div class="chips">
              <VChip
                closable
                size="small"
                class="chip-item"
                @click:close.stop=""
              >
                <template #close>
                  <VIcon
                    size="16"
                    icon="mdi-close-circle"
                  />
                </template>
                Draft
              </VChip>
              <VChip
                v-for="index in 10"
                :key="index"
                closable
                size="small"
                class="chip-item"
                @click:close.stop=""
              >
                <template #close>
                  <VIcon
                    size="16"
                    icon="mdi-close-circle"
                  />
                </template>
                Publikovany
              </VChip>
            </div>
          </div>
          <div class="chip-group">
            <div class="group-label text-caption">
              Autor:
            </div>
            <div class="chips">
              <VChip
                closable
                size="small"
                class="chip-item"
                @click:close.stop=""
              >
                <template #close>
                  <VIcon
                    size="16"
                    icon="mdi-close-circle"
                  />
                </template>
                Jozko Mrkvicka
              </VChip>
              <VChip
                v-for="index in 10"
                :key="index"
                closable
                size="small"
                class="chip-item"
                @click:close.stop=""
              >
                <template #close>
                  <VIcon
                    size="16"
                    icon="mdi-close-circle"
                  />
                </template>
                Eduard Jahodka
              </VChip>
            </div>
          </div>
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

<style lang="scss">
.chip-group {
  display: inline-flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 20px;
  padding: 4px 4px 4px 12px;
  margin: 0 4px 2px 0;
  gap: 8px;
  max-width: 100%;

  .group-label {
    white-space: nowrap;
  }

  .chips {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .chip-item {
    background: white;
    box-shadow: none;

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
