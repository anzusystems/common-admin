import useVuelidate from '@vuelidate/core'
import { computed, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { useValidate } from '@/shared/validators/vuelidate/useValidate'
import type { BaseUser } from '@/shared/types/AnzuUser'

export interface UserMetadataValidationOptions {
  /**
   * The system's profile (`requiredMetadata` on its descriptor). `false` requires only the
   * e-mail. `true` also requires first, last and full name, avatar text and avatar colour.
   * It applies equally to create and edit.
   */
  required: MaybeRefOrGetter<boolean>
  /**
   * Whether the id is a field at all. When it is, and this is a create, it is required.
   */
  idInput: MaybeRefOrGetter<boolean>
  isEdit: MaybeRefOrGetter<boolean>
  /**
   * Scope key, so an owning form can validate its own fields alongside the app's system fields.
   */
  scope?: string | symbol | false
}

/**
 * The `BaseUserDto` rules, per profile.
 * Lengths follow backend constraints (`email` 256, first/last 120, full 242, avatar text 2-3). The
 * backend requires only the e-mail. The front end is deliberately stricter, as set by `requiredMetadata`.
 */
export function useUserMetadataValidation(user: Ref<BaseUser>, options: UserMetadataValidationOptions) {
  const { email, hexColor, maxLength, minLength, required } = useValidate()

  const rules = computed(() => {
    // Read inside the computed, not at setup. The "not found anywhere" dialog switches the target
    // system under a mounted form, and a profile captured at mount would keep the first system's rules.
    const requiredWhenProfileSays = toValue(options.required) ? { required } : {}

    return {
      user: {
        // Required only on create where the id is typed. On edit it is a
        // displayed primary key, and in cms the backend resolves it from SSO.
        id: toValue(options.idInput) && !toValue(options.isEdit) ? { required } : {},
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
          // Check the shape, not the length: `minLength(7)` accepts `#GGGGGG`, which the server rejects.
          // `hexColor` passes an empty value, so a profile without a required colour still saves.
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
