<script lang="ts" setup>
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { ButtonVariant } from '@/types/commonAdmin'

const props = withDefaults(
  defineProps<{
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    loading?: boolean
    disabled?: boolean
    size?: number
    variant?: ButtonVariant
  }>(),
  {
    buttonT: 'common.button.save',
    buttonClass: 'ml-2',
    dataCy: 'button-save',
    loading: undefined,
    disabled: undefined,
    size: 36,
    variant: 'primary',
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

const variantComputed = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'outlined'
    case 'tertiary':
    case 'icon':
      return 'text'
    default:
      return 'flat'
  }
})
</script>

<template>
  <VBtn
    v-if="variant === 'icon'"
    :class="buttonClass"
    :data-cy="dataCy"
    icon
    size="small"
    :variant="variantComputed"
    :loading="loading"
    :disabled="disabled"
    :width="size"
    :height="size"
    @click.stop="onClick"
  >
    <VIcon icon="mdi-content-save" />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t(buttonT) }}
    </VTooltip>
  </VBtn>
  <VBtn
    v-else
    :class="buttonClass"
    :data-cy="dataCy"
    :variant="variantComputed"
    color="primary"
    rounded="pill"
    :loading="loading"
    :disabled="disabled"
    :height="size"
    @click.stop="onClick"
  >
    {{ t(buttonT) }}
  </VBtn>
</template>
