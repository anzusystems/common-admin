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
      title: t('common.damImage.author.authorType.none'),
    },
    {
      value: AuthorType.Internal,
      title: t('common.damImage.author.authorType.internal'),
    },
    {
      value: AuthorType.External,
      title: t('common.damImage.author.authorType.external'),
    },
    {
      value: AuthorType.Agency,
      title: t('common.damImage.author.authorType.agency'),
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
