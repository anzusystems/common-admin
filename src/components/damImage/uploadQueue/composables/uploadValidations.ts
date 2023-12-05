import type { Ref } from 'vue'
import { computed } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import type { ValidationScope } from '@/types/Validation'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'

export const ADamAssetMetadataValidationScopeSymbol = Symbol.for('anzu:common:asset-metadata-validation-scope')

export const AImageMetadataValidationScopeSymbol = Symbol.for('anzu:common:image-validation-scope')

export const ADamKeywordCreateValidationScopeSymbol = Symbol.for('anzu:common:keyword-create-validation-scope')

export const ADamAuthorCreateValidationScopeSymbol = Symbol.for('anzu:common:author-create-validation-scope')

const { required, maxLength } = useValidate()

export function useImageValidation(
  image: Ref<ImageCreateUpdateAware | null>,
  validationScope: ValidationScope = undefined
) {
  const rules = computed(() => ({
    image: {
      texts: {
        source: {
          required,
          minLength: maxLength(255),
        },
      },
    },
  }))
  const v$ = useVuelidate(rules, { image }, { $scope: validationScope })

  return {
    v$,
  }
}
