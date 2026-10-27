import useVuelidate from '@vuelidate/core'
import type { Ref } from 'vue'
import { useValidate } from '@/shared/validators/vuelidate/useValidate'
import type { PermissionGroup } from '@/domains/permission/group/types/PermissionGroup'

/**
 * Not derived from the backend: `PermissionGroupDto` only requires a title.
 * The lengths are a stricter front-end profile shared by all admins.
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
