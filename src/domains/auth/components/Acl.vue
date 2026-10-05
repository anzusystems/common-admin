<script lang="ts" setup generic="TAclValue extends RegisteredAclValue">
import { computed } from 'vue'
import type { RegisteredAclValue } from '@/domains/auth/types/Permission'
import { useAuthHelpers } from '@/domains/auth/composables/defineAuth'

const props = withDefaults(
  defineProps<{
    // An array is evaluated with AND. Values from different systems are handled correctly --
    // every system involved must be loaded, or the slot stays hidden -- but keeping them from one
    // system is still the clearer thing to write.
    permission: TAclValue | TAclValue[]
    subject?: object
  }>(),
  {
    subject: undefined,
  }
)

const { canSafeHelper } = useAuthHelpers<TAclValue>()

/**
 * A computed, not a watcher that latches on the first `true`: it re-evaluates when its own system's
 * current user arrives, and a permission taken away is taken away without a reload.
 *
 * This is the non-throwing variant of `can()`, for templates that may render before their system is
 * there -- `canSafeHelper` answers false where `canHelper` would throw.
 */
const allowed = computed<boolean>(() => canSafeHelper(props.permission, props.subject, 'Acl'))
</script>

<template>
  <slot v-if="allowed" />
</template>
