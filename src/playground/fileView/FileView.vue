<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AFileInput from '@/components/file/AFileInput.vue'

const onInput = (files: File[]) => {
  console.log(files)
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>File</VCardTitle>
    <VCardText>
      <VRow>
        <VCol cols="4">
          <AFileInput
            multiple
            @files-input="onInput"
          >
            <template #activator="{ props }">
              <VBtn
                color="primary"
                v-bind="props"
              >
                Upload file
              </VBtn>
            </template>
          </AFileInput>
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="4">
          <AFileInput
            use-dropzone
            multiple
            @files-input="onInput"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
