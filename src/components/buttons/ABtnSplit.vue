<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { eventClickBlur } from '@/utils/event'
import type { ButtonVariantText } from '@/types/commonAdmin'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    loading?: boolean
    disabled?: boolean
    disableMore?: boolean
    size?: undefined | 'small' | 'x-small'
    variant?: ButtonVariantText
    rounded?: 'pill' | undefined
    color?: string
  }>(),
  {
    buttonT: '',
    buttonClass: 'ml-2',
    dataCy: 'button-save',
    loading: undefined,
    disabled: undefined,
    disableMore: false,
    size: undefined,
    variant: 'primary',
    rounded: undefined,
    color: 'primary',
  }
)
const emit = defineEmits<{
  (e: 'onClick'): void
}>()

const onClick = (event: Event) => {
  eventClickBlur(event)
  emit('onClick')
}

const variantComputed = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'outlined'
    case 'tertiary':
      return 'text'
    default:
      return 'flat'
  }
})

const loadingComputed = computed(() => {
  if (!props.loading) return false
  switch (variantComputed.value) {
    case 'flat':
      return 'white'
    default:
      return 'primary'
  }
})

const { t } = useI18n()
</script>

<template>
  <VBtn
    v-if="disableMore"
    :variant="variantComputed"
    :class="buttonClass"
    :data-cy="dataCy"
    :color="color"
    :rounded="rounded"
    :size="size"
    :loading="loadingComputed"
    :disabled="disabled"
    @click.stop="onClick"
  >
    <slot name="button-content">
      {{ t(buttonT) }}
    </slot>
  </VBtn>
  <div
    v-else
    class="a-button-split d-inline-flex"
    :class="buttonClass + ' a-button-split--' + variant"
  >
    <VBtn
      class="a-button-split__main"
      :variant="variantComputed"
      :data-cy="dataCy"
      :loading="loadingComputed"
      :disabled="disabled"
      :size="size"
      :rounded="rounded"
      :color="color"
      @click.stop="onClick"
    >
      <slot name="button-content">
        {{ t(buttonT) }}
      </slot>
    </VBtn>
    <div class="a-button-split__divider d-inline-flex" />
    <VDivider
      v-if="variant === 'tertiary'"
      vertical
      class="my-2 border-opacity-50"
      :color="color"
    />
    <VBtn
      :variant="variantComputed"
      :disabled="disabled || loading"
      :data-cy="dataCy"
      :color="color"
      :rounded="rounded"
      :size="size"
      class="a-button-split__more"
    >
      <VIcon icon="mdi-chevron-down" />
      <VMenu
        activator="parent"
        location="bottom right"
      >
        <VList
          density="compact"
          class="pa-0"
        >
          <slot name="default" />
        </VList>
      </VMenu>
    </VBtn>
  </div>
</template>

<style lang="scss">
.a-button-split {
  .a-button-split__main {
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    padding-right: 10px !important;
  }

  .a-button-split__more {
    border-top-left-radius: 0 !important;
    border-bottom-left-radius: 0 !important;
    padding: 0 4px 0 0 !important;
    min-width: 32px !important;
  }

  .a-button-split__divider {
    display: inline-block;
    width: 1px;
  }

  &--secondary {
    .a-button-split__more {
      left: -2px;
    }
  }
}
</style>
