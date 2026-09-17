<script lang="ts" setup generic="TAclValue extends AclValue">
import { computed } from 'vue'
import type { AclValue } from '@/types/Permission'
import { getSystemFromAcl, useAuthHelpers } from '@/composables/auth/defineAuth'
import { isArray, isUndefined } from '@/utils/common'
import { useAuthStore } from '@/composables/auth/authStore'

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

const authStore = useAuthStore()
const { canHelper, canForAllHelper } = useAuthHelpers()

/**
 * A computed, not a watcher that latches on the first `true`.
 *
 * The old version watched `currentUsers` without `deep`, so it ran once on mount and never again
 * -- `.set()` on the map changes no dependency the watcher had tracked. That was invisible while
 * every current user was loaded before anything mounted, and stops being invisible the moment
 * they are loaded on demand. It also meant a permission taken away stayed granted until reload.
 *
 * Reading `currentUsers.get(system)` tracks that one key, so this re-evaluates when its own
 * system arrives and stays put when another one does.
 */
const allowed = computed<boolean>(() => {
  const acls = isArray(props.permission) ? props.permission : [props.permission]

  // No permission to check, nothing to deny. `canForAllHelper([])` has always answered true and
  // there would be no system to ask about anyway.
  if (acls.length === 0) {
    return true
  }

  // Every value is checked, not just the first: an array may name more than one system, and
  // checking only the first would leave `canHelper` to throw on the second -- exactly what this
  // component exists to avoid.
  const systems = acls.map((acl) => getSystemFromAcl(acl))

  // `canHelper` throws for a system nothing ever tried to load. That is the right answer for
  // `can()` in a guard, where it catches a page rendering too early -- but this component is the
  // non-throwing variant, used in templates that may render before their system is there.
  // Reading each user tracks that key, so this re-evaluates when its own system arrives.
  for (const system of systems) {
    authStore.currentUsers.value.get(system)
    if (isUndefined(authStore.isCurrentUserLoadedBySystem(system))) {
      return false
    }
  }

  return isArray(props.permission)
    ? canForAllHelper(props.permission, props.subject)
    : canHelper(props.permission, props.subject)
})
</script>

<template>
  <slot v-if="allowed" />
</template>
