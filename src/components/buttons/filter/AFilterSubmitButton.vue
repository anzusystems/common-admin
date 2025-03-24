<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    touched?: boolean
  }>(),
  {
    buttonT: 'common.button.submitFilter',
    buttonClass: '',
    dataCy: 'filter-submit',
    touched: true,
  }
)

const { t } = useI18n()
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    color="primary"
    type="submit"
    :variant="touched ? 'flat' : 'text'"
  >
    {{ t(buttonT) }}
  </VBtn>
</template>
