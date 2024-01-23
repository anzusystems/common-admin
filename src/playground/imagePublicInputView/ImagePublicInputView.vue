<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AImagePublicInput from '@/components/damImage/AImagePublicInput.vue'
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Image public input</VCardTitle>
    <VCardText>
      <VRow>
        <VCol cols="4">
          <AImagePublicInput
            :select-config="[
              {
                title: 'Default',
                licence: 100000,
                extSystem: 1,
              },
              {
                title: '2',
                licence: 100001,
                extSystem: 1,
              },
            ]"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
