<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    routeName: string
    buttonT?: string
    buttonClass?: string
    dataCy?: string
  }>(),
  {
    buttonT: 'common.button.close',
    buttonClass: 'ml-2',
    dataCy: 'button-close',
  }
)

const { t } = useI18n()
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    :to="{ name: routeName }"
    icon
    size="small"
    variant="outlined"
    :width="36"
    :height="36"
  >
    <VIcon icon="mdi-close" />
    <VTooltip activator="parent" location="bottom">{{ t('common.button.close') }}</VTooltip>
  </VBtn>
</template>
