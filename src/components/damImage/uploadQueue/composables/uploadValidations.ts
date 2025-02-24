import type { Ref } from 'vue'
import { computed } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'
import type { MediaAware } from '@/types/MediaAware'
import { isImageCreateUpdateAware } from '@/components/damImage/uploadQueue/composables/imageMediaWidgetStore'

export const ADamAssetMetadataValidationScopeSymbol = Symbol.for('anzu:common:asset-metadata-validation-scope')

export const AImageMetadataValidationScopeSymbol = Symbol.for('anzu:common:image-validation-scope')

export const ADamKeywordCreateValidationScopeSymbol = Symbol.for('anzu:common:keyword-create-validation-scope')

export const ADamAuthorCreateValidationScopeSymbol = Symbol.for('anzu:common:author-create-validation-scope')

export function useImageValidation(
  image: Ref<ImageCreateUpdateAware | MediaAware | null>,
  sourceRequired: Ref<boolean>
) {
  const { requiredIf, maxLength } = useValidate()
  const rules = computed(() => {
    if (isImageCreateUpdateAware(image.value)) {
      return {
        image: {
          texts: {
            description: {
              maxLength: maxLength(2000),
            },
            source: {
              required: requiredIf(sourceRequired.value),
              maxLength: maxLength(255),
            },
          },
        },
      }
    }
    return {}
  })
  const v$ = useVuelidate(rules, { image }, { $scope: AImageMetadataValidationScopeSymbol })

  return {
    v$,
  }
}
