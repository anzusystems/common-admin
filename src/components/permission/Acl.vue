<script lang="ts" setup generic="TAclValue extends AclValue">
import { computed, ref, watch, type WatchStopHandle } from 'vue'
import type { AclValue } from '@/types/Permission'
import { useAuthHelpers } from '@/composables/auth/defineAuth'
import { isArray } from '@/utils/common'
import { useAuthStore } from '@/composables/auth/authStore'

const props = withDefaults(
  defineProps<{
    permission: TAclValue | TAclValue[] // multiple values must be from same system!
    subject?: object
  }>(),
  {
    subject: undefined,
  }
)

const allowed = ref<boolean>(false)

const authStore = useAuthStore()

const system = computed(() => {
  let parts = []
  if (isArray(props.permission)) {
    parts = props.permission[0].split('_')
  } else {
    parts = props.permission.split('_')
  }
  return parts[0] || ''
})

const currentUsers = computed(() => {
  return authStore.currentUsers.value
})

const { canHelper, canForAllHelper } = useAuthHelpers()

const can = (acls: TAclValue[] | TAclValue, subject?: object) => {
  if (isArray(acls)) {
    return canForAllHelper(acls, subject)
  }

  return canHelper(acls, subject)
}

let watchHandle: WatchStopHandle
watchHandle = watch(
  currentUsers,
  (newValue) => {
    if (newValue.size > 0) {
      const show = can(props.permission, props.subject)
      if (show) {
        allowed.value = show
        stopWatch()
      }
    }
  },
  {
    immediate: true,
  }
)

function stopWatch() {
  setTimeout(() => watchHandle?.(), 0)
}
</script>

<template>
  <slot v-if="allowed" />
</template>
