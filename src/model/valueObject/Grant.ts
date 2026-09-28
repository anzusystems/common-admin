import { ref } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { useI18n } from 'vue-i18n'

export const Grant = {
  Deny: 0,
  AllowOwner: 1,
  Allow: 2,
} as const
export type GrantType = (typeof Grant)[keyof typeof Grant]
export const GrantDefault = Grant.Deny

export function useGrant() {
  const { t } = useI18n()

  const grantOptions = ref<ValueObjectOption<GrantType>[]>([
    {
      value: Grant.Deny,
      title: t('common.permission.grant.deny'),
      color: 'error',
    },
    {
      value: Grant.AllowOwner,
      title: t('common.permission.grant.allowOwner'),
      color: 'warning',
    },
    {
      value: Grant.Allow,
      title: t('common.permission.grant.allow'),
      color: 'success',
    },
  ])

  const getGrantOption = (value: GrantType): ValueObjectOption<GrantType> => {
    return grantOptions.value.find((item) => item.value === value) as ValueObjectOption<GrantType>
  }

  return {
    grantOptions,
    getGrantOption,
  }
}
