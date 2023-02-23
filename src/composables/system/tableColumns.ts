import { isUndefined } from '@/utils/common'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

export const DATETIME_AUTO_FORMAT_COLUMN_NAMES = ['createdAt', 'modifiedAt']
export const DATETIME_AUTO_LABEL_TRACKING = ['createdAt', 'modifiedAt']

export type ColumnConfig = {
  name: string
  label?: string
  type?: 'default' | 'datetime'
  getLabel?: (system: string | undefined, subject: string | undefined) => string | undefined
}

export interface UseTableColumns {
  availableColumns: Ref<ColumnConfig[]>
  get: (name: string) => ColumnConfig | undefined
}

const getLabelForConfig = (
  config: ColumnConfig,
  system: string | undefined = '',
  subject: string | undefined = ''
): string | undefined => {
  const { t } = useI18n()
  if (!config) return undefined
  if (!isUndefined(config.label)) return config.label
  if (DATETIME_AUTO_LABEL_TRACKING.includes(config.name)) return t('common.tracking.' + config.name)
  if (!isUndefined(system) && !isUndefined(subject)) return t(system + '.' + subject + '.model.' + config.name)
  return undefined
}

const defaultColumn: ColumnConfig = {
  name: '',
  label: '',
  getLabel: () => '',
}

export function useTableColumns(config: ColumnConfig[]): UseTableColumns {
  const map = (config: ColumnConfig) => {
    return {
      ...config,
      getLabel: (system: string | undefined = '', subject: string | undefined = '') =>
        getLabelForConfig(config, system, subject),
    }
  }

  const availableColumns = ref<ColumnConfig[]>(config.map((item) => map(item))) as Ref<ColumnConfig[]>

  const find = (name: string) => {
    return availableColumns.value.find((item) => item.name === name)
  }

  const get = (name: string) => {
    const found = find(name)
    if (isUndefined(found)) return defaultColumn
    return found as ColumnConfig
  }

  return {
    availableColumns,
    get,
  }
}
