import { ref } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { useI18n } from 'vue-i18n'

export enum GrantOrigin {
  Role = 'role',
  Group = 'group',
  User = 'user',
  DefaultGrant = 'default',
  Default = DefaultGrant,
}

export function useGrantOrigin() {
  const { t } = useI18n()

  const grantOriginOptions = ref<ValueObjectOption<GrantOrigin>[]>([
    {
      value: GrantOrigin.Role,
      title: t('permission.grantOrigin.role'),
    },
    {
      value: GrantOrigin.Group,
      title: t('permission.grantOrigin.group'),
    },
    {
      value: GrantOrigin.User,
      title: t('permission.grantOrigin.user'),
    },
    {
      value: GrantOrigin.DefaultGrant,
      title: t('permission.grantOrigin.defaultGrant'),
    },
  ])

  const getGrantOriginOption = (value: GrantOrigin): ValueObjectOption<GrantOrigin> => {
    return grantOriginOptions.value.find((item) => item.value === value) as ValueObjectOption<GrantOrigin>
  }

  return {
    grantOriginOptions,
    getGrantOriginOption,
  }
}
