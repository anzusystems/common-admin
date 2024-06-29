<script lang="ts" setup generic="TAclValue extends AclValue">
import { ref, watch } from 'vue'
import type { AclValue } from '@/types/Permission'
import { defineAuth } from '@/composables/auth/defineAuth'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    permission: TAclValue
    subject?: object
  }>(),
  {
    subject: undefined,
  }
)

const getSystemFromAcl = (acl: TAclValue) => {
  const parts = acl.split('_')
  return parts[0]
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { can, useCurrentUser } = defineAuth<AclValue>(getSystemFromAcl(props.permission))
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { currentUser } = useCurrentUser(getSystemFromAcl(props.permission))

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const allowed = ref<boolean>(false)

watch(
  currentUser,
  (newValue) => {
    if (!isUndefined(newValue)) {
      allowed.value = can(props.permission, props.subject)
    }
  },
  {
    immediate: true,
  }
)
</script>

<template>
  <slot v-if="allowed" />
</template>
