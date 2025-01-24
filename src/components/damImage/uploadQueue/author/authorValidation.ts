import type { Ref } from 'vue'
import { computed } from 'vue'
import useVuelidate from '@vuelidate/core'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import type { ValidationScope } from '@/types/Validation'
import { useValidate } from '@/validators/vuelidate/useValidate'

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
