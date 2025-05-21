import { ref } from 'vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { i18n } from '@/plugins/i18n'
import { apiAnyRequest } from '@/services/api/v2/apiAnyRequest'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiGenerateListQuery } from '@/services/api/v2/apiFetchList2'
import type { Pagination } from '@/types/Pagination'
import type { IntegerId } from '@/types/common'
import { isUndefined } from '@/utils/common'
import type { FilterConfig, FilterData } from '@/composables/filter/filterFactory'
import type { TimeIntervalToolsValue } from '@/components/filter2/variant/filterTimeIntervalTools'
import { TimeIntervalSpecialOptions } from '@/components/filter2/variant/filterTimeIntervalTools'

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

const datatableHiddenColumns = ref<Array<string>>([
  'id',
  'docId',
  'version',
  'discriminator',
  'site',
  'desk',
  'dates.publicPublishedAt',
  'dates.expireAt',
  'modifiedAt',
  'stages',
])

const listLoading = ref(false)
const listItems = ref<Array<any>>([])
const END_POINT = '/adm/v1/article-kind'

export const useSubjectListActions = () => {
  const mapVersionDataStandard = (items: any[], versionItems: any[]) => {
    const final: any[] = []
    const hasVersionData: IntegerId[] = []
    const alreadyInList = new Set<IntegerId>()
    const versionItemsMap = new Map<IntegerId, any>()
    versionItems.forEach((item) => {
      versionItemsMap.set(item.id, item)
    })
    items.forEach((item) => {
      if (!alreadyInList.has(item.id)) {
        if (item.articleVersions.length === 1) {
          const found = versionItemsMap.get(item.articleVersions[0])
          if (item.status === SubjectStatus.Published) {
            final.push({
              ...item,
              versionsData: found,
            })
            hasVersionData.push(item.id)
          } else if (!isUndefined(found)) {
            final.push({
              ...found,
              versionsData: item,
            })
            hasVersionData.push(found.id)
          }
          if (!isUndefined(found)) {
            alreadyInList.add(found.id)
          }
          alreadyInList.add(item.id)
        } else {
          final.push(item)
          alreadyInList.add(item.id)
        }
      }
    })

    return {
      items: final,
      hasVersionData,
    }
  }

  const fetchArticleListVersionData = async (
    pagination: Pagination,
    filterData: FilterData,
    filterConfig: FilterConfig
  ) => {
    filterData.discriminator = 'standard'
    const res = await apiAnyRequest<any>(
      cmsClient,
      'GET',
      END_POINT + '/search' + apiGenerateListQuery(pagination, filterData, filterConfig),
      {},
      undefined,
      'cms',
      'subject'
    )
    pagination.hasNextPage = res.hasNextPage
    pagination.currentViewCount = res.data.length

    return mapVersionDataStandard(res.data, res.versionsData)
  }

  const fetchList = async (pagination: Pagination, filterData: FilterData, filterConfig: FilterConfig) => {
    listLoading.value = true
    // try {
      const res = await fetchArticleListVersionData(pagination, filterData, filterConfig)
      listItems.value = res.items
    // } catch (error) {
      // showErrorsDefault(error)
    // } finally {
      listLoading.value = false
    // }
  }

  return {
    datatableHiddenColumns,
    listLoading,
    fetchList,
    listItems,
  }
}

export const allowedTimeIntervalValuesSubject: TimeIntervalToolsValue[] = [
  1_440,
  10_080,
  40_320,
  TimeIntervalSpecialOptions.CurrentMonth,
  TimeIntervalSpecialOptions.LastMonth,
  TimeIntervalSpecialOptions.Last3Months,
  TimeIntervalSpecialOptions.Custom,
]
