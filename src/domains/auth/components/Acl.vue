<script lang="ts" setup generic="TAclValue extends RegisteredAclValue">
import { computed } from 'vue'
import type { RegisteredAclValue } from '@/domains/auth/types/Permission'
import { useAuthHelpers } from '@/domains/auth/composables/defineAuth'

const props = withDefaults(
  defineProps<{
    // An array is evaluated with AND. Values from different systems work:
    // every involved system must be loaded, or the slot stays hidden.
    // Prefer values from one system for clarity.
    permission: TAclValue | TAclValue[]
    subject?: object
  }>(),
  {
    subject: undefined,
  }
)

const { canSafeHelper } = useAuthHelpers<TAclValue>()

/**
 * A computed, not a watcher latching on the first `true`. It re-evaluates when its
 * system's current user arrives, and a revoked permission applies without a reload.
 * Uses `canSafeHelper` because the template may render before its system is loaded. `canHelper` would throw.
 */
const allowed = computed<boolean>(() => canSafeHelper(props.permission, props.subject, 'Acl'))
</script>

<template>
  <slot v-if="allowed" />
</template>
