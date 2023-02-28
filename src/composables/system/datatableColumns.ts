import { isUndefined } from '@/utils/common'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { i18n } from '@/plugins/i18n'

export const DATETIME_AUTO_FORMAT_COLUMN_NAMES = ['createdAt', 'modifiedAt']
export const DATETIME_AUTO_LABEL_TRACKING = ['createdAt', 'modifiedAt']

const { t } = i18n.global

export type DatatableColumnConfig = {
  name: string
  label?: string
  type?: 'default' | 'datetime'
  getLabel?: (system: string | undefined, subject: string | undefined) => string | undefined
}

export interface UseTableColumns {
  availableColumns: Ref<DatatableColumnConfig[]>
  get: (name: string) => DatatableColumnConfig | undefined
}

const getLabelForConfig = (
  config: DatatableColumnConfig,
  system: string | undefined = '',
  subject: string | undefined = ''
): string | undefined => {
  if (!config) return undefined
  if (!isUndefined(config.label)) return config.label
  if (DATETIME_AUTO_LABEL_TRACKING.includes(config.name)) return t('common.model.tracking.' + config.name)
  if (!isUndefined(system) && !isUndefined(subject)) return t(system + '.' + subject + '.model.' + config.name)
  return undefined
}

const defaultColumn: DatatableColumnConfig = {
  name: '',
  label: '',
  getLabel: () => '',
}

export function useDatatableColumns(config: DatatableColumnConfig[]): UseTableColumns {
  const map = (config: DatatableColumnConfig) => {
    return {
      ...config,
      getLabel: (system: string | undefined = '', subject: string | undefined = '') =>
        getLabelForConfig(config, system, subject),
    }
  }

  const availableColumns = ref<DatatableColumnConfig[]>(config.map((item) => map(item))) as Ref<DatatableColumnConfig[]>

  const find = (name: string) => {
    return availableColumns.value.find((item) => item.name === name)
  }

  const get = (name: string) => {
    const found = find(name)
    if (isUndefined(found)) return defaultColumn
    return found as DatatableColumnConfig
  }

  return {
    availableColumns,
    get,
  }
}
