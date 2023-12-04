import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValueObjectOption } from '@/types/ValueObject'
export enum AuthorType {
  None = 'none',
  Internal = 'internal',
  External = 'external',
  Agency = 'agency',
  Default = None,
}

export function useAuthorType() {
  const { t } = useI18n()

  const authorTypeOptions = ref<ValueObjectOption<AuthorType>[]>([
    {
      value: AuthorType.None,
      title: t('coreDam.author.authorType.none'),
    },
    {
      value: AuthorType.Internal,
      title: t('coreDam.author.authorType.internal'),
    },
    {
      value: AuthorType.External,
      title: t('coreDam.author.authorType.external'),
    },
    {
      value: AuthorType.Agency,
      title: t('coreDam.author.authorType.agency'),
    },
  ])

  const getAuthorTypeOption = (value: AuthorType) => {
    return authorTypeOptions.value.find((item) => item.value === value)
  }

  return {
    authorTypeOptions,
    getAuthorTypeOption,
  }
}
