import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValueObjectOption } from '@/types/ValueObject'

export const CustomDataFormElementType = {
  String: 'string',
  Integer: 'integer',
  StringArray: 'stringArray',
  StringArrayLegacy: 'string_array', // todo: remove
  Boolean: 'boolean',
} as const
export const CustomDataFormElementTypeDefault = CustomDataFormElementType.String
export type CustomDataFormElementTypeType = (typeof CustomDataFormElementType)[keyof typeof CustomDataFormElementType]

export function useCustomDataFormElementType() {
  const { t } = useI18n()
  const customDataFormElementTypeOptions = ref<ValueObjectOption<CustomDataFormElementTypeType>[]>([
    {
      value: CustomDataFormElementType.String,
      title: t('common.customFormElement.type.string'),
    },
    {
      value: CustomDataFormElementType.Integer,
      title: t('common.customFormElement.type.integer'),
    },
    {
      value: CustomDataFormElementType.StringArray,
      title: t('common.customFormElement.type.C'),
    },
    {
      value: CustomDataFormElementType.StringArrayLegacy,
      title: t('common.customFormElement.type.stringArrayLegacy'),
    },
    {
      value: CustomDataFormElementType.Boolean,
      title: t('common.customFormElement.type.boolean'),
    },
  ])

  const getCustomDataFormElementTypeOption = (value: CustomDataFormElementTypeType) => {
    return customDataFormElementTypeOptions.value.find((item) => item.value === value)
  }

  return {
    customDataFormElementTypeOptions,
    getCustomDataFormElementTypeOption,
  }
}
