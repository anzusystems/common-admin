<script lang="ts" setup>
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    buttonT?: string
    buttonClass?: string
    dataCy?: string
  }>(),
  {
    buttonT: 'common.button.submitFilter',
    buttonClass: '',
    dataCy: 'filter-submit',
  }
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
    color="success"
    type="submit"
    elevation="0"
    @click.stop="onClick"
  >
    {{ t(buttonT) }}
  </VBtn>
</template>
