import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { objectGetValueByPath } from '@/lib'

export const useJobPriority = () => {
  const { t } = useI18n()
  const priorityLabels = computed(() => {
    return {
      0: t('common.job.meta.priority.low'),
      1: t('common.job.meta.priority.medium'),
      2: t('common.job.meta.priority.high'),
    }
  })

  const getPriorityColor = (priority: number): string => {
    switch (priority) {
      case 0:
        return 'amber'
      case 1:
        return 'primary'
      case 2:
        return 'red'
      default:
        return 'default'
    }
  }

  const getPriorityLabel = (priority: number): string => {
    return objectGetValueByPath(priorityLabels.value, priority.toString()) ?? priority.toString()
  }

  return {
    priorityLabels,
    getPriorityColor,
    getPriorityLabel,
  }
}
