import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValueObjectOption } from '@/types/ValueObject'

export const CustomFormElementType = {
  String: 'string',
  Integer: 'integer',
  StringArray: 'string_array',
  Boolean: 'boolean',
} as const
export const CustomFormElementTypeDefault = CustomFormElementType.String
export type CustomFormElementTypeType = (typeof CustomFormElementType)[keyof typeof CustomFormElementType]

export function useCustomFormElementType() {
  const { t } = useI18n()
  const customFormElementTypeOptions = ref<ValueObjectOption<CustomFormElementTypeType>[]>([
    {
      value: CustomFormElementType.String,
      title: t('common.customFormElement.type.string'),
    },
    {
      value: CustomFormElementType.Integer,
      title: t('common.customFormElement.type.integer'),
    },
    {
      value: CustomFormElementType.StringArray,
      title: t('common.customFormElement.type.stringArray'),
    },
    {
      value: CustomFormElementType.Boolean,
      title: t('common.customFormElement.type.boolean'),
    },
  ])

  const getCustomFormElementTypeOption = (value: CustomFormElementTypeType) => {
    return customFormElementTypeOptions.value.find((item) => item.value === value)
  }

  return {
    customFormElementTypeOptions,
    getCustomFormElementTypeOption,
  }
}
