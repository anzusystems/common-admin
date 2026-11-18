import type { Ref } from 'vue'
import { computed } from 'vue'
import useVuelidate from '@vuelidate/core'
import type { DamAuthor } from '@/domains/dam/author/types/DamAuthor'
import type { ValidationScope } from '@/shared/types/Validation'
import { useValidate } from '@/shared/validators/vuelidate/useValidate'

const { required, minLength } = useValidate()

export function useAuthorValidation(author: Ref<DamAuthor>, validationScope: ValidationScope = undefined) {
  const rules = computed(() => ({
    author: {
      name: {
        required,
        minLength: minLength(2),
      },
      identifier: {
        minLength: minLength(3),
      },
    },
  }))
  const v$ = useVuelidate(rules, { author }, { $scope: validationScope })

  return {
    v$,
  }
}
