<script lang="ts" setup>
import { ref } from 'vue'
import type { DocId } from '@/types/common'
import AChipNoLink from '@/components/AChipNoLink.vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AArticleSelect from '@/components/cms/articleSelect/AArticleSelect.vue'

const pickedArticleIds = ref<DocId[]>([])

const onConfirm = (data: DocId[]) => {
  pickedArticleIds.value = data
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <VRow>
        <VCol cols="10">
          <AArticleSelect
            :min-count="1"
            :max-count="3"
            @on-confirm="onConfirm"
          >
            <template #activator="{ props }">
              <VBtn
                color="primary"
                v-bind="props"
              >
                Add articles
              </VBtn>
            </template>
          </AArticleSelect>
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          Picked ids:
          <AChipNoLink
            v-for="docId in pickedArticleIds"
            :key="docId"
          >
            {{ docId }}
          </AChipNoLink>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
