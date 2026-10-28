<script lang="ts" setup>
import type { RegisteredAclValue } from '@/domains/auth/types/Permission'
import { useAclAllowed } from '@/domains/auth/composables/aclAllowed'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { isUndefined } from '@/shared/utils/common'

const props = withDefaults(
  defineProps<{
    routeName: string
    recordId?: number | string | undefined
    routeParams?: any | undefined
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    // Shown only when the current user passes it; no ACL, no check. An array is evaluated with AND.
    acl?: RegisteredAclValue | RegisteredAclValue[]
    subject?: object
  }>(),
  {
    acl: undefined,
    subject: undefined,
    recordId: undefined,
    routeParams: undefined,
    buttonT: 'common.button.detail',
    buttonClass: 'ml-1',
    dataCy: 'table-detail',
  }
)

const aclAllowed = useAclAllowed(
  () => props.acl,
  () => props.subject
)

const { t } = useI18n()

const routerToComputed = computed(() => {
  if (!isUndefined(props.routeParams)) {
    return { name: props.routeName, params: { ...props.routeParams } }
  }
  return { name: props.routeName, params: { id: props.recordId } }
})
</script>

<template>
  <template v-if="aclAllowed">
    <VBtn
      :class="buttonClass"
      :aria-label="t(buttonT)"
      :data-cy="dataCy"
      :to="routerToComputed"
      icon
      :active="false"
      size="x-small"
      variant="text"
      @click.stop="() => {}"
    >
      <VIcon icon="mdi-information-outline" />
      <VTooltip
        activator="parent"
        location="bottom"
      >
        {{ t(buttonT) }}
      </VTooltip>
    </VBtn>
  </template>
</template>
