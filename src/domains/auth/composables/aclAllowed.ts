import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue'
import type { RegisteredAclValue } from '@/domains/auth/types/Permission'
import { useAuthHelpers } from '@/domains/auth/composables/defineAuth'
import { isUndefined } from '@/shared/utils/common'

/**
 * Whether a component guarded by an optional ACL may show itself.
 * No ACL means no guard, so callers that pass none keep the old behaviour. Never throws (see `canSafeHelper`).
 */
export function useAclAllowed(
  acl: MaybeRefOrGetter<RegisteredAclValue | RegisteredAclValue[] | undefined>,
  subject: MaybeRefOrGetter<object | undefined> = undefined
): ComputedRef<boolean> {
  const { canSafeHelper } = useAuthHelpers<RegisteredAclValue>()

  return computed(() => {
    const value = toValue(acl)
    if (isUndefined(value)) return true

    return canSafeHelper(value, toValue(subject))
  })
}
