import useVuelidate from '@vuelidate/core'
import { computed, type Ref } from 'vue'
import { useValidate } from '@/validators/vuelidate/useValidate'
import type { BaseUser } from '@/types/AnzuUser'

export interface UserMetadataValidationOptions {
  /**
   * The system's profile (`requiredMetadata` on its descriptor). `false` requires only the
   * e-mail; `true` also requires first name, last name, full name, avatar text and avatar colour.
   * It applies the same way to creating and to editing -- within a system it is one rule.
   */
  required: boolean
  /** Whether the id is a field at all. When it is, and this is a create, it is required. */
  idInput: boolean
  isEdit: boolean
  /** Scope key, so an owning form can validate its own fields alongside the app's system fields. */
  scope?: string | symbol | false
}

/**
 * The `BaseUserDto` rules, per profile.
 *
 * The lengths come from the backend constraints (`email` 256, first/last 120, full 242, avatar
 * text 2-3). The backend requires only the e-mail; the front end is deliberately stricter, and
 * `requiredMetadata` is what says by how much.
 */
export function useUserMetadataValidation(user: Ref<BaseUser>, options: UserMetadataValidationOptions) {
  const { email, hexColor, maxLength, minLength, required } = useValidate()

  const rules = computed(() => {
    const requiredWhenProfileSays = options.required ? { required } : {}

    return {
      user: {
        // Only on a create, and only where the id is typed at all: on an edit it is a primary key
        // being displayed, and in cms the backend resolves it from SSO.
        id: options.idInput && !options.isEdit ? { required } : {},
        email: {
          required,
          email,
          maxLength: maxLength(256),
        },
        person: {
          firstName: { ...requiredWhenProfileSays, minLength: minLength(2), maxLength: maxLength(120) },
          lastName: { ...requiredWhenProfileSays, minLength: minLength(2), maxLength: maxLength(120) },
          fullName: { ...requiredWhenProfileSays, minLength: minLength(3), maxLength: maxLength(242) },
        },
        avatar: {
          // Shape, not length: `minLength(7)` lets `#GGGGGG` through and the server rejects it.
          // The rule passes an empty value, so a profile that does not require a colour still saves.
          color: { ...requiredWhenProfileSays, hexColor },
          text: { ...requiredWhenProfileSays, minLength: minLength(2), maxLength: maxLength(3) },
        },
      },
    }
  })

  const v$ = useVuelidate(rules, { user }, options.scope === undefined ? undefined : { $scope: options.scope })

  return {
    v$,
  }
}
