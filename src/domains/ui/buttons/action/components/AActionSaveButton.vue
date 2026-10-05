<script lang="ts" setup>
import type { RegisteredAclValue } from '@/domains/auth/types/Permission'
import { useAclAllowed } from '@/domains/auth/composables/aclAllowed'
import { eventClickBlur } from '@/shared/utils/event'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { ButtonVariant } from '@/shared/types/commonAdmin'

const props = withDefaults(
  defineProps<{
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    loading?: boolean
    disabled?: boolean
    size?: number
    variant?: ButtonVariant
    // Shown only when the current user passes it; no ACL, no check. An array is evaluated with AND.
    acl?: RegisteredAclValue | RegisteredAclValue[]
    subject?: object
  }>(),
  {
    acl: undefined,
    subject: undefined,
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

const aclAllowed = useAclAllowed(
  () => props.acl,
  () => props.subject
)

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
    v-if="aclAllowed && variant === 'icon'"
    :aria-label="t(buttonT)"
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
    v-else-if="aclAllowed"
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
