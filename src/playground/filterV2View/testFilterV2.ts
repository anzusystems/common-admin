import { reactive, ref } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import { useI18n } from 'vue-i18n'
import type { ValueObjectOption } from '@/types/ValueObject'

const makeFilter = makeFilterHelper('cms', 'subject')

const filter = reactive({
  _elastic: {
    ...makeFilter({ exclude: true }),
  },
  docId: {
    ...makeFilter({ name: 'docId', advanced: true }),
  },
  text: {
    ...makeFilter({ name: 'text' }),
  },
  headline: {
    ...makeFilter({ name: 'headline' }),
  },
  url: {
    ...makeFilter({ name: 'url', advanced: true }),
  },
  site: {
    ...makeFilter({ name: 'site', field: 'siteIds', default: [] }),
  },
  rubric: {
    ...makeFilter({ name: 'rubrics', field: 'rubricIds', default: [] }),
  },
  desk: {
    ...makeFilter({ name: 'desks', field: 'deskIds', default: [], advanced: true }),
  },
  status: {
    ...makeFilter({ name: 'status' }),
  },
  linkedList: {
    ...makeFilter({ name: 'linkedList', field: 'linkedListIds' }),
  },
  discriminator: {
    // todo remove later
    ...makeFilter({ name: 'discriminator' }),
  },
  lockType: {
    ...makeFilter({ name: 'lockType', advanced: true }),
  },
  publicPublishedAtFrom: {
    ...makeFilter({ name: 'publicPublishedAtFrom', advanced: true }),
  },
  publicPublishedAtUntil: {
    ...makeFilter({ name: 'publicPublishedAtUntil', advanced: true }),
  },
  modifiedAtFrom: {
    ...makeFilter({ name: 'modifiedAtFrom', advanced: true }),
  },
  modifiedAtUntil: {
    ...makeFilter({ name: 'modifiedAtUntil', advanced: true }),
  },
  owners: {
    ...makeFilter({ name: 'owners', field: 'ownerIds', default: [], advanced: true }),
  },
  keywords: {
    ...makeFilter({ name: 'keywords', field: 'keywordIds', default: [] }),
  },
  articleAuthors: {
    ...makeFilter({ name: 'articleAuthors', field: 'authorIds', default: [] }),
  },
})

export function useTestListFilter() {
  return filter
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
