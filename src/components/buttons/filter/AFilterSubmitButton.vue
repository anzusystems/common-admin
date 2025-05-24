<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { eventClickBlur } from '@/utils/event'

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

const emit = defineEmits<{
  (e: 'submit'): void
}>()

const { t } = useI18n()

const onClick = (event: Event) => {
  eventClickBlur(event)
  emit('submit')
}
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    color="primary"
    type="submit"
    :variant="touched ? 'flat' : 'text'"
    @click="onClick"
  >
    {{ t(buttonT) }}
  </VBtn>
</template>
