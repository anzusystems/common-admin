<script lang="ts" setup generic="TAclValue extends AclValue">
import { ref, watch } from 'vue'
import type { AclValue } from '@/types/Permission'
import { defineAuth } from '@/composables/auth/defineAuth'

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
const allowed = ref<boolean>(can(props.permission, props.subject))

watch(currentUser, () => {
  allowed.value = can(props.permission, props.subject)
})
</script>

<template>
  <slot v-if="allowed" />
</template>
