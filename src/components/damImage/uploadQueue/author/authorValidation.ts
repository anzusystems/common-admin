import type { Ref } from 'vue'
import { computed } from 'vue'
import useVuelidate from '@vuelidate/core'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import type { ValidationScope } from '@/types/Validation'
import { useValidate } from '@/validators/vuelidate/useValidate'
import { useI18n } from 'vue-i18n'
import { helpers } from '@vuelidate/validators'
import { DamAuthorType } from '@/components/damImage/uploadQueue/author/DamAuthorType'

const { required, minLength } = useValidate()

export function useAuthorValidation(
  author: Ref<DamAuthor>,
  validationScope: ValidationScope = undefined,
) {
  const { t } = useI18n()

  const sourceType = helpers.withMessage(
    () => t('common.damImage.author.validation.sourceType'),
    (value: string) => !author.value.flags.source || value !== DamAuthorType.None,
  )

  const rules = computed(() => ({
    author: {
      name: {
        required,
        minLength: minLength(2),
      },
      identifier: {
        minLength: minLength(2),
      },
      type: {
        sourceType,
      },
    },
  }))
  const v$ = useVuelidate(rules, { author }, { $scope: validationScope })

  return {
    v$,
  }
}
