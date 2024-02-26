<script lang="ts" setup>
import { ref } from 'vue'
import AAssetSelect from '@/components/dam/assetSelect/AAssetSelect.vue'
import type { DocId } from '@/types/common'
import AChipNoLink from '@/components/AChipNoLink.vue'
import { DamAssetType } from '@/types/coreDam/Asset'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import type { AssetSelectReturnData } from '@/types/coreDam/AssetSelect'

const secondDialog = ref(false)
const thirdAssetSelect = ref<InstanceType<typeof AAssetSelect> | null>(null)

const pickedAssetIds = ref<DocId[]>([])

const openThirdDialog = () => {
  if (!thirdAssetSelect.value) return
  thirdAssetSelect.value.open()
}

const onConfirm = (data: AssetSelectReturnData) => {
  if (data.type === 'mainFileId') {
    pickedAssetIds.value = data.value
  }
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
          <AAssetSelect
            :min-count="1"
            :max-count="3"
            :select-licences="[100000, 100001]"
            :asset-type="DamAssetType.Image"
            @on-confirm="onConfirm"
          >
            <template #activator="{ props }">
              <VBtn
                color="primary"
                v-bind="props"
              >
                Add image
              </VBtn>
            </template>
          </AAssetSelect>
        </VCol>
      </VRow>
      <VRow>
        <VCol> Open using v-model: </VCol>
      </VRow>
      <VRow>
        <VCol cols="10">
          <VBtn
            color="primary"
            @click.stop="secondDialog = true"
          >
            Add image
          </VBtn>
          <AAssetSelect
            v-model="secondDialog"
            :select-licences="[100000]"
            :min-count="1"
            :max-count="1"
            :asset-type="DamAssetType.Video"
            @on-confirm="onConfirm"
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol> Open using template ref: </VCol>
      </VRow>
      <VRow>
        <VCol cols="10">
          <VBtn
            color="primary"
            @click.stop="openThirdDialog"
          >
            Add image
          </VBtn>
          <AAssetSelect
            ref="thirdAssetSelect"
            :select-licences="[100000]"
            :min-count="1"
            :max-count="1"
            :asset-type="DamAssetType.Audio"
            @on-confirm="onConfirm"
          />
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
    </VCardText>
  </VCard>
</template>
