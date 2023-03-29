<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'
import type { ButtonVariant } from '@/types/commonAdmin'
import { computed } from 'vue'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    routeName: string
    recordId?: number | string | undefined
    routeParams?: any | undefined
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    loading?: boolean
    size?: number
    variant?: ButtonVariant
  }>(),
  {
    recordId: undefined,
    routeParams: undefined,
    buttonT: 'common.button.edit',
    buttonClass: 'ml-2',
    dataCy: 'button-edit',
    loading: false,
    size: 36,
    variant: 'primary',
  }
)
const emit = defineEmits<{
  (e: 'editRecord'): void
}>()

const { t } = useI18n()

const router = useRouter()

const onClick = (event: Event) => {
  eventClickBlur(event)
  emit('editRecord')
  router.push(routerToComputed.value)
}

const routerToComputed = computed(() => {
  if (!isUndefined(props.routeParams)) {
    return { name: props.routeName, params: { ...props.routeParams } }
  }
  return { name: props.routeName, params: { id: props.recordId } }
})

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
    icon
    size="small"
    :variant="variantComputed"
    :loading="loading"
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
    :variant="variantComputed"
    :data-cy="dataCy"
    :loading="loading"
    color="primary"
    rounded="pill"
    :height="size"
    @click.stop="onClick"
  >
    <span>{{ t(buttonT) }}</span>
  </VBtn>
</template>
