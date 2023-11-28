<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import AColorBox from '@/components/dam/AColorBox.vue'
import type { AssetFileImage } from '@/types/coreDam/AssetFile'
import ABooleanValue from '@/components/ABooleanValue.vue'

withDefaults(
  defineProps<{
    file: AssetFileImage
  }>(),
  {}
)

const { t } = useI18n()
</script>

<template>
  <VRow>
    <VCol>{{ t('coreDam.asset.detail.info.field.dominantColor') }}</VCol>
    <VCol cols="9">
      <AColorBox :color="file.imageAttributes.mostDominantColor" />
    </VCol>
  </VRow>
  <VRow>
    <VCol>{{ t('coreDam.asset.detail.info.field.width') }}</VCol>
    <VCol cols="9">
      {{ file.imageAttributes.width }} px
    </VCol>
  </VRow>
  <VRow>
    <VCol>{{ t('coreDam.asset.detail.info.field.height') }}</VCol>
    <VCol cols="9">
      {{ file.imageAttributes.height }} px
    </VCol>
  </VRow>
  <VRow>
    <VCol>{{ t('coreDam.asset.detail.info.field.ratio') }}</VCol>
    <VCol cols="9">
      {{ file.imageAttributes.ratioWidth }} / {{ file.imageAttributes.ratioHeight }}
    </VCol>
  </VRow>
  <VRow>
    <VCol>{{ t('coreDam.asset.detail.info.field.animated') }}</VCol>
    <VCol cols="9">
      <ABooleanValue :value="file.imageAttributes.animated" />
    </VCol>
  </VRow>
</template>
