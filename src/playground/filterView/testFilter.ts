import { reactive, ref } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import { dateTimeEndOfDay, dateTimeStartOfDay } from '@/utils/datetime'
import { useI18n } from 'vue-i18n'
import type { ValueObjectOption } from '@/types/ValueObject'

const makeFilter = makeFilterHelper('system', 'subject')

const filter = reactive({
  _elastic: {
    ...makeFilter({ exclude: true }),
  },
  text: {
    ...makeFilter({ name: 'text', variant: 'contains' }),
  },
  id: {
    ...makeFilter({ name: 'id' }),
  },
  status: {
    ...makeFilter({ name: 'status' }),
  },
  docId: {
    ...makeFilter({ name: 'docId', advanced: true }),
  },
  title: {
    ...makeFilter({ name: 'title', variant: 'contains', advanced: true }),
  },
  blog: {
    ...makeFilter({ name: 'blog', variant: 'in', apiName: 'blogId', advanced: true }),
  },
  url: {
    ...makeFilter({ name: 'url', advanced: true }),
  },
  publishedAtFrom: {
    ...makeFilter({
      name: 'publishedAtFrom',
      apiName: 'publishedAt',
      variant: 'gte',
      default: dateTimeStartOfDay(-100),
      mandatory: true,
      advanced: true,
    }),
  },
  publishedAtUntil: {
    ...makeFilter({
      name: 'publishedAtUntil',
      apiName: 'publishedAt',
      variant: 'lte',
      default: dateTimeEndOfDay(),
      mandatory: true,
      advanced: true,
    }),
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

export function useArticleStatus() {
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
