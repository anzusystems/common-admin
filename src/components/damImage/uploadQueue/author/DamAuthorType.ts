import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValueObjectOption } from '@/types/ValueObject'

export enum DamAuthorType {
  None = 'none',
  Internal = 'internal',
  External = 'external',
  Agency = 'agency',
  Default = None,
}

export function useDamAuthorType() {
  const { t } = useI18n()

  const authorTypeOptions = ref<ValueObjectOption<DamAuthorType>[]>([
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

  const getAuthorTypeOption = (value: DamAuthorType) => {
    return authorTypeOptions.value.find((item) => item.value === value)
  }

  return {
    authorTypeOptions,
    getAuthorTypeOption,
  }
}
