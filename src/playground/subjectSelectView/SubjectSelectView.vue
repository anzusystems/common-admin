<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import PollSelectTable from '@/playground/subjectSelectView/PollSelectTable.vue'
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
          <PollSelectTable
            :min-count="1"
            :max-count="3"
            @on-confirm="onConfirm"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
