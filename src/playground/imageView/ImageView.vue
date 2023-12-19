<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import AImageWidget from '@/components/damImage/AImageWidget.vue'
import { ref } from 'vue'
import type { IntegerIdNullable } from '@/types/common'
import ADialogToolbar from '@/components/ADialogToolbar.vue'

const imageId = ref<IntegerIdNullable>(null)
const imageId2 = ref<IntegerIdNullable>(null)

const dialog = ref(false)
const widgetComponent = ref<InstanceType<typeof AImageWidget> | null>(null)

const saveInsideDialog = () => {
  widgetComponent.value?.metadataConfirm()
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Image</VCardTitle>
    <VCardText>
      <VRow>
        <VCol cols="4">
          <AImageWidgetSimple
            :model-value="imageId"
            label="Simple image view"
          >
            <template #append="{ image }">
              DAM ID: {{ image?.dam.damId }}
            </template>
          </AImageWidgetSimple>
        </VCol>
        <VCol cols="4">
          <AImageWidget
            v-model="imageId2"
            :upload-config="{
              licence: 100000,
              extSystem: 1,
            }"
            :select-config="[
              {
                title: 'Default',
                licence: 100000,
                extSystem: 1,
              },
            ]"
            queue-key="heroImage"
            label="Lead image"
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="4">
          Expanded actions:
          <AImageWidget
            v-model="imageId2"
            :upload-config="{
              licence: 100000,
              extSystem: 1,
            }"
            :select-config="[
              {
                title: 'Default',
                licence: 100000,
                extSystem: 1,
              },
            ]"
            queue-key="listingImage"
            expand-options
          />
        </VCol>
        <VCol cols="4">
          Expanded actions & metadata - only one at once in dialogs like embed:
          <VBtn @click.stop="dialog = true">
            Open dialog
          </VBtn>
          <VDialog
            v-model="dialog"
            :max-width="500"
          >
            <VCard v-if="dialog">
              <ADialogToolbar @on-cancel="dialog = false">
                test
              </ADialogToolbar>
              <VCardText>
                <VRow>
                  <VCol>
                    <AImageWidget
                      ref="widgetComponent"
                      v-model="imageId2"
                      :upload-config="{
                        licence: 100000,
                        extSystem: 1,
                      }"
                      :select-config="[
                        {
                          title: 'Default',
                          licence: 100000,
                          extSystem: 1,
                        },
                      ]"
                      queue-key="embedImage"
                      expand-options
                      expand-metadata
                      @after-metadata-save-success="dialog = false"
                    />
                  </VCol>
                </VRow>
              </VCardText>
              <VCardActions>
                <VSpacer />
                <ABtnPrimary @click.stop="saveInsideDialog">
                  Confirm
                </ABtnPrimary>
              </VCardActions>
            </VCard>
          </VDialog>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
