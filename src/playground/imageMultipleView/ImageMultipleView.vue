<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { ref } from 'vue'
import type { IntegerId } from '@/types/common'
import AImageWidgetMultiple from '@/components/damImage/AImageWidgetMultiple.vue'
import AImageWidgetMultipleSimple from '@/components/damImage/AImageWidgetMultipleSimple.vue'

const imageIds = ref<IntegerId[]>([])

const component = ref<InstanceType<typeof AImageWidgetMultiple> | null>(null)

const save = () => {
  component.value?.saveImages()
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Image multiple</VCardTitle>
    <VCardText>
      <VRow>
        <VCol>
          {{ imageIds }}
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          Simple:<br>
          <AImageWidgetMultipleSimple
            v-model="imageIds"
            show-description
            show-source
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          Editable<br>
          <VBtn @click.stop="save">
            Save editable
          </VBtn>
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          <AImageWidgetMultiple
            ref="component"
            v-model="imageIds"
            :upload-config="{
              licence: 1000001,
              extSystem: 1,
            }"
            :select-config="[
              {
                title: 'Default',
                licence: 1000001,
                extSystem: 1,
              },
            ]"
            :licence-id="100001"
            :ext-system="1"
            queue-key="gallery"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
