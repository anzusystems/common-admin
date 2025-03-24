import { ref } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { i18n } from '@/plugins/i18n'

export const SubjectStatus = {
  Draft: 'draft',
  Ready: 'ready',
  Published: 'published',
} as const

export type SubjectStatusType = (typeof SubjectStatus)[keyof typeof SubjectStatus]

export function useSubjectStatus() {
  const { t } = i18n.global

  const subjectStatusOptions = ref<ValueObjectOption<SubjectStatusType>[]>([
    {
      value: SubjectStatus.Draft,
      title: t('system.subject.subjectStatus.draft'),
      color: 'default',
    },
    {
      value: SubjectStatus.Ready,
      title: t('system.subject.subjectStatus.ready'),
      color: 'warning',
    },
    {
      value: SubjectStatus.Published,
      title: t('system.subject.subjectStatus.published'),
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
  const { t } = i18n.global

  const subjectLockTypeOptions = ref<ValueObjectOption<SubjectLockTypeType>[]>([
    {
      value: SubjectLockType.Free,
      title: t('system.subject.subjectLockType.free'),
    },
    {
      value: SubjectLockType.Locked,
      title: t('system.subject.subjectLockType.locked'),
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
