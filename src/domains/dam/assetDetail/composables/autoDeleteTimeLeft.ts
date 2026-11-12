import { useIntervalFn } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'
import type { DatetimeUTCNullable } from '@/shared/types/common'
import { dateDiff, dateNow, dateTimeToDate } from '@/shared/utils/datetime'

/**
 * Seconds left until DAM deletes the asset (`autoDeleteAt`), never below zero; `null` when it is not deleted.
 * The time moves on while it is shown: a clock ticks every minute, and only while there is a date.
 * Call it in component setup, the clock stops with the component.
 */
export function useAutoDeleteTimeLeft(autoDeleteAt: () => DatetimeUTCNullable | undefined) {
  const now = shallowRef(dateNow())
  const clock = useIntervalFn(
    () => {
      now.value = dateNow()
    },
    60_000,
    { immediate: false }
  )
  watch(
    autoDeleteAt,
    (value) => {
      now.value = dateNow()
      if (value) clock.resume()
      else clock.pause()
    },
    { immediate: true }
  )

  const secondsLeft = computed(() => {
    const value = autoDeleteAt()
    if (!value) return null
    return Math.max(0, dateDiff(dateTimeToDate(value), now.value, 's'))
  })

  return { secondsLeft }
}
