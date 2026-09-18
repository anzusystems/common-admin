import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import useVuelidate from '@vuelidate/core'
import type { DatetimeUTCNullable } from '@/types/common'
import { useValidate } from '@/validators/vuelidate/useValidate'

export interface DemoCompareDates {
  dates: {
    publicPublishedAt: DatetimeUTCNullable
    publicUpdatedAt: DatetimeUTCNullable
    publishedAt: DatetimeUTCNullable
  }
}

export function useCompareValidators(article: Ref<DemoCompareDates>) {
  const { t } = useI18n()
  const { datesCompare } = useValidate()

  const publicPublishedAtComputed = computed(() => {
    return article.value.dates.publicPublishedAt
  })

  const publicUpdatedAtComputed = computed(() => {
    return article.value.dates.publicUpdatedAt
  })

  const rules = {
    article: {
      dates: {
        publishedAt: {
          datesCompare: datesCompare(
            publicPublishedAtComputed,
            t('cms.articleKind.model.dates.publicPublishedAt'),
            'onOrAfter'
          ),
        },
        publicPublishedAt: {
          datesCompare: datesCompare(
            publicUpdatedAtComputed,
            t('cms.articleKind.model.dates.publicUpdatedAt'),
            'earlierThan'
          ),
        },
        publicUpdatedAt: {
          datesCompare: datesCompare(
            publicPublishedAtComputed,
            t('cms.articleKind.model.dates.publicPublishedAt'),
            'laterThan'
          ),
        },
      },
    },
  }

  const v$ = useVuelidate(rules, { article }, { $scope: 'demo-compare-dates' })

  return {
    v$,
  }
}
