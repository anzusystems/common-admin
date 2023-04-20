<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import type { ButtonVariant } from '@/types/commonAdmin'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    routeName: string
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    size?: number
    variant?: ButtonVariant
  }>(),
  {
    buttonT: 'common.button.create',
    buttonClass: 'ml-2',
    dataCy: 'button-create',
    size: 36,
    variant: 'primary',
  }
)

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
    :to="{ name: routeName }"
    :width="size"
    :height="size"
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
    :to="{ name: routeName }"
    color="primary"
    rounded="pill"
    :height="size"
  >
    {{ t(buttonT) }}
  </VBtn>
</template>
