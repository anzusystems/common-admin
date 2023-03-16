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
  },
)
const emit = defineEmits<{
  (e: 'submit'): void
}>()

const onClick = (event: Event) => {
  eventClickBlur(event)
  emit('submit')
}

const { t } = useI18n()
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    color="primary"
    type="submit"
    :variant="touched ? 'flat' : 'text'"
    @click.stop="onClick"
  >
    {{ t(buttonT) }}
  </VBtn>
</template>
