import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValueObjectOption } from '@/types/ValueObject'

export const DamAuthorType = {
  None: 'none',
  Internal: 'internal',
  External: 'external',
  Agency: 'agency',
} as const
export type DamAuthorTypeType = (typeof DamAuthorType)[keyof typeof DamAuthorType]
export const DamAuthorTypeDefault = DamAuthorType.None

export function useDamAuthorType() {
  const { t } = useI18n()

  const authorTypeOptions = ref<ValueObjectOption<DamAuthorTypeType>[]>([
    {
      value: DamAuthorType.None,
      title: t('common.damImage.author.authorType.none'),
    },
    {
      value: DamAuthorType.Internal,
      title: t('common.damImage.author.authorType.internal'),
    },
    {
      value: DamAuthorType.External,
      title: t('common.damImage.author.authorType.external'),
    },
    {
      value: DamAuthorType.Agency,
      title: t('common.damImage.author.authorType.agency'),
    },
  ])

  const getAuthorTypeOption = (value: DamAuthorTypeType) => {
    return authorTypeOptions.value.find((item) => item.value === value)
  }

  return {
    authorTypeOptions,
    getAuthorTypeOption,
  }
}
