import type { Ref } from 'vue'
import { computed } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'
import type { MediaAware } from '@/types/MediaAware'
import { isImageCreateUpdateAware } from '@/components/damImage/uploadQueue/composables/imageMediaWidgetStore'
import type { ImageFieldValidationConfig } from '@/AnzuSystemsCommonAdmin'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

export const ADamAssetMetadataValidationScopeSymbol = Symbol.for(
  'anzu:common:asset-metadata-validation-scope',
)

export const AImageMetadataValidationScopeSymbol = Symbol.for('anzu:common:image-validation-scope')

export const ADamKeywordCreateValidationScopeSymbol = Symbol.for(
  'anzu:common:keyword-create-validation-scope',
)

export const ADamAuthorCreateValidationScopeSymbol = Symbol.for(
  'anzu:common:author-create-validation-scope',
)

export function buildFieldRules(
  config: ImageFieldValidationConfig,
  validators: ReturnType<typeof useValidate>,
  requiredOverride?: boolean,
) {
  const rules: Record<string, unknown> = {}
  const isRequired = requiredOverride ?? config.required
  if (isRequired) {
    rules.required = validators.required
  }
  if (config.min && config.min > 0) {
    rules.minLength = validators.minLength(config.min)
  }
  if (config.max && config.max > 0) {
    rules.maxLength = validators.maxLength(config.max)
  }
  return rules
}

export function useImageValidation(
  image: Ref<ImageCreateUpdateAware | MediaAware | null>,
  sourceRequired: Ref<boolean>,
  configName?: string,
) {
  const { descriptionValidation, sourceValidation } = useCommonAdminCoreDamOptions(configName)
  const validators = useValidate()
  const rules = computed(() => {
    if (isImageCreateUpdateAware(image.value)) {
      return {
        image: {
          texts: {
            description: buildFieldRules(descriptionValidation, validators),
            source: buildFieldRules(
              sourceValidation,
              validators,
              sourceValidation.required && sourceRequired.value,
            ),
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
