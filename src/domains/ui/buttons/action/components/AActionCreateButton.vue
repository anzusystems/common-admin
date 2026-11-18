<script lang="ts" setup>
import type { RegisteredAclValue } from '@/domains/auth/types/Permission'
import { useAclAllowed } from '@/domains/auth/composables/aclAllowed'
import { useI18n } from 'vue-i18n'
import type { ButtonVariant } from '@/shared/types/commonAdmin'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    routeName: string
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    size?: number
    variant?: ButtonVariant
    // Shown only when the current user passes it; no ACL, no check. An array is evaluated with AND.
    acl?: RegisteredAclValue | RegisteredAclValue[]
    subject?: object
  }>(),
  {
    acl: undefined,
    subject: undefined,
    buttonT: 'common.button.create',
    buttonClass: 'ml-2',
    dataCy: 'button-create',
    size: 36,
    variant: 'primary',
  }
)

const aclAllowed = useAclAllowed(
  () => props.acl,
  () => props.subject
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
    v-if="aclAllowed && variant === 'icon'"
    :aria-label="t(buttonT)"
    :class="buttonClass"
    :data-cy="dataCy"
    icon
    size="small"
    :variant="variantComputed"
    :to="{ name: routeName }"
    :width="size"
    :height="size"
  >
    <VIcon icon="mdi-plus" />
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
    :to="{ name: routeName }"
    color="primary"
    rounded="pill"
    :height="size"
  >
    {{ t(buttonT) }}
  </VBtn>
</template>
