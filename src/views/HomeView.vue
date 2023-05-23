<script lang="ts" setup>
import AAssetSelect from '@/components/dam/assetSelect/AAssetSelect.vue'
import type { DocId } from '@/types/common'

const onConfirm = (data: DocId[]) => {
  console.log(data)
}

</script>

<template>
  <AAssetSelect
    :asset-licence-id="100000"
    :max-count="1"
    asset-type="image"
    @on-confirm="onConfirm"
  >
    <template #button-open-dialog="{ activator }">
      <VBtn
        color="primary"
        @click.stop="activator"
      >
        Add image
      </VBtn>
    </template>
  </AAssetSelect>

  <AAssetSelect
    :asset-licence-id="100000"
    :max-count="1"
    asset-type="video"
    @on-confirm="onConfirm"
  >
    <template #button-open-dialog="{ activator }">
      <VBtn
        color="primary"
        @click.stop="activator"
      >
        Add Video
      </VBtn>
    </template>
  </AAssetSelect>

  <AAssetSelect
    :asset-licence-id="100000"
    :max-count="2"
    asset-type="audio"
    @on-confirm="onConfirm"
  >
    <template #button-open-dialog="{ activator }">
      <VBtn
        color="primary"
        @click.stop="activator"
      >
        Add audio
      </VBtn>
    </template>
  </AAssetSelect>
</template>
