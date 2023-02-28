<script lang="ts" setup>
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    buttonT?: string
    buttonClass?: string
    icon?: boolean
    dataCy?: string
    loading?: boolean
    disabled?: boolean
  }>(),
  {
    buttonT: 'common.button.save',
    buttonClass: 'ml-2',
    icon: false,
    dataCy: 'button-save',
    loading: undefined,
    disabled: undefined,
  }
)
const emit = defineEmits<{
  (e: 'saveRecord'): void
}>()

const onClick = (event: Event) => {
  eventClickBlur(event)
  emit('saveRecord')
}

const { t } = useI18n()
</script>

<template>
  <VBtn
    v-if="icon"
    :class="buttonClass"
    :elevation="2"
    icon
    size="small"
    variant="outlined"
    :loading="loading"
    :disabled="disabled"
    @click.stop="onClick"
  >
    <VIcon icon="mdi-content-save" />
    <VTooltip activator="parent" location="bottom">{{ t(buttonT) }}</VTooltip>
  </VBtn>
  <VBtn
    v-else
    :class="buttonClass"
    :data-cy="dataCy"
    color="primary"
    rounded="pill"
    :loading="loading"
    :disabled="disabled"
    @click.stop="onClick"
  >
    {{ t(buttonT) }}
  </VBtn>
</template>
