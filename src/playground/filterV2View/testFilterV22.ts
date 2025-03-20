import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValueObjectOption } from '@/types/ValueObject'
import { createFilter, type MakeFilterOptions } from '@/composables/filter/filterFactory.ts'

const filterFields: MakeFilterOptions = [
  { name: 'text', default: '' },
  { name: 'status', default: [] },
]

const { filterConfig, filterData } = createFilter(filterFields, { elastic: true, system: 'cms', subject: 'subject' })

export function useTestListFilter() {
  return {
    filterConfigSubject: filterConfig,
    filterDataSubject: filterData,
  }
}

export const SubjectStatus = {
  Draft: 'draft',
  Ready: 'ready',
  Published: 'published',
} as const

export type SubjectStatusType = (typeof SubjectStatus)[keyof typeof SubjectStatus]

export function useSubjectStatus() {
  const { t } = useI18n()

  const subjectStatusOptions = ref<ValueObjectOption<SubjectStatusType>[]>([
    {
      value: SubjectStatus.Draft,
      title: t('system.subject.articleStatus.draft'),
      color: 'default',
    },
    {
      value: SubjectStatus.Ready,
      title: t('system.subject.articleStatus.ready'),
      color: 'warning',
    },
    {
      value: SubjectStatus.Published,
      title: t('system.subject.articleStatus.published'),
      color: 'success',
    },
  ])

  const getSubjectStatusOption = (value: SubjectStatusType) => {
    return subjectStatusOptions.value.find((item) => item.value === value)
  }

  return {
    subjectStatusOptions,
    getSubjectStatusOption,
  }
}

export const SubjectLockType = {
  Free: 'free',
  Locked: 'locked',
} as const
export type SubjectLockTypeType = (typeof SubjectLockType)[keyof typeof SubjectLockType]
export const SubjectLockTypeDefault = SubjectLockType.Free

export function useSubjectLockType() {
  const { t } = useI18n()

  const subjectLockTypeOptions = ref<ValueObjectOption<SubjectLockTypeType>[]>([
    {
      value: SubjectLockType.Free,
      title: t('system.subject.articleLockType.free'),
    },
    {
      value: SubjectLockType.Locked,
      title: t('system.subject.articleLockType.locked'),
    },
  ])

  const getSubjectLockTypeOption = (value: SubjectLockTypeType) => {
    return subjectLockTypeOptions.value.find((item) => item.value === value)
  }

  return {
    subjectLockTypeOptions,
    getSubjectLockTypeOption,
  }
}
