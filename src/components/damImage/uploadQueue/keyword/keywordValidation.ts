import type { Ref } from 'vue'
import { computed } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import type { DamKeyword } from '@/components/damImage/uploadQueue/keyword/DamKeyword'
import type { ValidationScope } from '@/types/Validation'

const { required, minLength } = useValidate()

export function useKeywordValidation(keyword: Ref<DamKeyword>, validationScope: ValidationScope = undefined) {
  const rules = computed(() => ({
    keyword: {
      name: {
        required,
        minLength: minLength(3),
      },
    },
  }))
  const v$ = useVuelidate(rules, { keyword }, { $scope: validationScope })

  return {
    v$,
  }
}
