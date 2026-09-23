import useVuelidate from '@vuelidate/core'
import type { Ref } from 'vue'
import { useValidate } from '@/validators/vuelidate/useValidate'
import type { PermissionGroup } from '@/types/PermissionGroup'

/**
 * The same three rules all five admins carry today, verbatim. They are not derived from the
 * backend: `PermissionGroupDto` only requires a title, and the lengths here are the front-end's
 * own stricter profile.
 */
export function usePermissionGroupValidation(permissionGroup: Ref<PermissionGroup>) {
  const { maxLength, minLength, required } = useValidate()

  const rules = {
    permissionGroup: {
      title: {
        required,
        minLength: minLength(3),
        maxLength: maxLength(255),
      },
      description: {
        maxLength: maxLength(2000),
      },
    },
  }

  const v$ = useVuelidate(rules, { permissionGroup })

  return {
    v$,
  }
}
