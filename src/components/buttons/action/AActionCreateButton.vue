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
    buttonT: 'common.button.create',
    buttonClass: 'ml-2',
    dataCy: 'button-create',
  }
)
const { t } = useI18n()
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    :to="{ name: routeName }"
    color="success"
    rounded="pill"
  >
    {{ t(buttonT) }}
  </VBtn>
</template>
