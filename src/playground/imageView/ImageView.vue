<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import AImageWidget from '@/components/damImage/AImageWidget.vue'
import { ref } from 'vue'
import type { IntegerIdNullable } from '@/types/common'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import useVuelidate from '@vuelidate/core'

const imageId = ref<IntegerIdNullable>(null)
const imageId2 = ref<IntegerIdNullable>(null)
const imageId3 = ref<IntegerIdNullable>(null)

const v$ = useVuelidate({ $scope: 'aaa' })
const isValid = ref<boolean | null>(null)

const validate = async () => {
  v$.value.$touch()
  isValid.value = await v$.value.$validate()
  console.log(v$.value.$errors)
}

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
            :upload-licence="100000"
            :select-licences="[100000, 100001]"
            queue-key="heroImage"
            label="Lead image"
          />
        </VCol>
        <VCol cols="4">
          <AImageWidget
            v-model="imageId3"
            :upload-licence="100000"
            :select-licences="[100000, 100001]"
            queue-key="heroImage2"
            label="Lead image 2 with global validation test"
          />
          <div>isvalid (should be always true, use scope, always): {{ isValid }}</div>
          <VBtn @click.stop="validate">
            validate should not fire nested widget validation
          </VBtn>
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="4">
          Expanded actions:
          <AImageWidget
            v-model="imageId2"
            :upload-licence="100000"
            :select-licences="[100000, 100001]"
            queue-key="listingImage"
            expand-options
          >
            <template #append="{ image }">
              {{ image }}
            </template>
          </AImageWidget>
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
                      :upload-licence="100000"
                      :select-licences="[100000, 100001]"
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
