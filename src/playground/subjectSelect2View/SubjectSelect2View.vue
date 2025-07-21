<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import PollSelectTable from '@/playground/subjectSelectView/PollSelectTable.vue'
import { ref } from 'vue'

const maxCount = ref(1)
const onConfirm = (data: any) => {
  console.log(data)
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <VRow>
        <VCol> Open using activator: </VCol>
      </VRow>
      <VRow>
        <VCol cols="10">
          <VTextField
            v-model.number="maxCount"
            type="number"
          />
          <PollSelectTable
            :min-count="1"
            :max-count="maxCount"
            @on-confirm="onConfirm"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
