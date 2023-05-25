<script lang="ts" setup>
import { ref } from 'vue'
import AAssetSelect from '@/components/dam/assetSelect/AAssetSelect.vue'
import ACard from '@/components/ACard.vue'
import type { DocId } from '@/types/common'
import AChipNoLink from '@/components/AChipNoLink.vue'
import { AssetType } from '@/types/coreDam/Asset'

const second = ref(100000)
const third = ref(100000)
const fisrt = ref(100000)
const pickedAssetIds = ref<DocId[]>([])

const onConfirm = (data: DocId[]) => {
  pickedAssetIds.value = data
}
</script>

<template>
  <ACard>
    <VRow>
      <VCol cols="2">
        <VTextField
          v-model="fisrt"
          type="number"
          label="Licence Id"
        />
      </VCol>
      <VCol cols="10">
        <AAssetSelect
          :min-count="1"
          :max-count="5"
          :asset-type="AssetType.Image"
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
      </VCol>
    </VRow>
    <VRow>
      <VCol cols="2">
        <VTextField
          v-model="second"
          type="number"
          label="Licence Id"
        />
      </VCol>
      <VCol cols="10">
        <AAssetSelect
          :asset-licence-id="second"
          :min-count="1"
          :max-count="1"
          :asset-type="AssetType.Video"
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
      </VCol>
    </VRow>
    <VRow>
      <VCol cols="2">
        <VTextField
          v-model="third"
          type="number"
          label="Licence Id"
        />
      </VCol>
      <VCol cols="10">
        <AAssetSelect
          :asset-licence-id="third"
          :min-count="1"
          :max-count="1"
          :asset-type="AssetType.Audio"
          @on-confirm="onConfirm"
        >
          <template #button-open-dialog="{ activator }">
            <VBtn
              color="primary"
              @click.stop="activator"
            >
              Add Audio
            </VBtn>
          </template>
        </AAssetSelect>
      </VCol>
    </VRow>
    <VRow>
      <VCol>
        Picked ids:
        <AChipNoLink
          v-for="docId in pickedAssetIds"
          :key="docId"
        >
          {{ docId }}
        </AChipNoLink>
      </VCol>
    </VRow>
  </ACard>
</template>
