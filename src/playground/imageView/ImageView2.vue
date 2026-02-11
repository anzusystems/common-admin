<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { ref } from 'vue'
import type { IntegerIdNullable } from '@/types/common'
import AImageWidgetBlog from '@/components/damImage/AImageWidgetBlog.vue'

const imageId4 = ref<IntegerIdNullable>(null)
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Image</VCardTitle>
    <VCardText>
      <VRow>
        <VCol cols="4">
          AImageWidgetBlog
          <AImageWidgetBlog
            v-model="imageId4"
            :upload-licence="110002"
            :select-licences="[110002]"
            queue-key="blogImage"
            label="Blog Image"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
