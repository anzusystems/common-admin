import { ref } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { useI18n } from 'vue-i18n'

export const GrantOrigin = {
  Role: 'role',
  Group: 'group',
  User: 'user',
  Default: 'default',
} as const
export type GrantOriginType = (typeof GrantOrigin)[keyof typeof GrantOrigin]
export const GrantOriginDefault = GrantOrigin.Default

export function useGrantOrigin() {
  const { t } = useI18n()

  const grantOriginOptions = ref<ValueObjectOption<GrantOriginType>[]>([
    {
      value: GrantOrigin.Role,
      title: t('common.permission.grantOrigin.role'),
    },
    {
      value: GrantOrigin.Group,
      title: t('common.permission.grantOrigin.group'),
    },
    {
      value: GrantOrigin.User,
      title: t('common.permission.grantOrigin.user'),
    },
    {
      value: GrantOriginDefault,
      title: t('common.permission.grantOrigin.defaultGrant'),
    },
  ])

  const getGrantOriginOption = (value: GrantOriginType): ValueObjectOption<GrantOriginType> => {
    return grantOriginOptions.value.find((item) => item.value === value) as ValueObjectOption<GrantOriginType>
  }

  return {
    grantOriginOptions,
    getGrantOriginOption,
  }
}
