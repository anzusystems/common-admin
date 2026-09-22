<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AUserCreateInSystemButton from '@/labs/anzuUser/AUserCreateInSystemButton.vue'
import AUserManageButton from '@/labs/anzuUser/AUserManageButton.vue'
import AUserSystemStatusChip from '@/labs/anzuUser/AUserSystemStatusChip.vue'
import type { AnyUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'
import { useUserSystemProbe, UserSystemRefreshHookKey } from '@/labs/anzuUser/userSystemProbe'
import { isAuthoritativelyAbsent, UserSystemAccess, UserSystemLoad } from '@/labs/anzuUser/userSystemState'
import type { BaseUser } from '@/types/AnzuUser'
import type { IntegerId } from '@/types/common'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    descriptor: AnyUserSystemDescriptor
    userId: IntegerId
    /**
     * On a viewing page there is no Create. A write action on a read-only screen would be the first
     * in the fleet; Manage stays, because it only leads somewhere.
     */
    readonly?: boolean
    /** Whether the account about to be created would be switched on. */
    createEnabled?: boolean
    /** What the owning system holds, to prefill the create form. */
    source?: BaseUser | null
    creating?: boolean
  }>(),
  {
    readonly: false,
    createEnabled: false,
    source: null,
    creating: false,
  }
)

const emit = defineEmits<{
  (e: 'create', descriptor: AnyUserSystemDescriptor, user: BaseUser): void
}>()

const { t } = useI18n()

// Provided once per page rather than passed down through every row.
const refreshHook = inject(UserSystemRefreshHookKey, undefined)

/* eslint-disable vue/no-setup-props-reactivity-loss */
const { axes, user, probe, cancel } = useUserSystemProbe({ descriptor: props.descriptor, refreshHook })
/* eslint-enable vue/no-setup-props-reactivity-loss */

const label = computed(() => props.descriptor.label ?? props.descriptor.system)

/**
 * The buttons are decided by the probe's answer, never by `<Acl>`.
 *
 * On a cross-system surface there is no current user loaded for the other backends, so `can()`
 * would throw and `<Acl>` would silently render nothing at all. The probe is the only signal there
 * is -- which is also why its 401 handling has to be right.
 */
const showManage = computed(
  () => axes.value.load === UserSystemLoad.Loaded && user.value !== null && !isUndefined(props.descriptor.manage)
)
const showCreate = computed(() => !props.readonly && isAuthoritativelyAbsent(axes.value))

const manageTarget = computed(() => {
  if (user.value === null || isUndefined(props.descriptor.manage)) return null
  return props.descriptor.manage(user.value)
})

const extraState = computed(() => {
  if (user.value === null || isUndefined(props.descriptor.extraState)) return null
  return props.descriptor.extraState(user.value)
})

const EXTRA_STATE_COLOR = { ok: 'success', warn: 'warning', error: 'error' } as const

const canRetry = computed(
  () => axes.value.access === UserSystemAccess.Unavailable || axes.value.access === UserSystemAccess.Unauthenticated
)

const run = () => probe(props.userId)

onMounted(run)

// The panel is mounted once and never re-created -- `VWindowItem` hides it with `v-show` -- so a
// new id has to reach it this way.
watch(() => props.userId, run)

onBeforeUnmount(cancel)

defineExpose({
  refresh: run,
})
</script>

<template>
  <div
    class="d-flex align-center flex-wrap ga-2"
    :data-cy="`user-system-panel-${descriptor.system}`"
  >
    <div class="font-weight-medium">{{ label }}</div>
    <AUserSystemStatusChip :axes="axes" />
    <VChip
      v-if="extraState"
      :color="EXTRA_STATE_COLOR[extraState.tone]"
      label
      size="small"
    >
      {{ extraState.label }}: {{ extraState.value }}
    </VChip>
    <div
      v-if="user"
      class="text-body-small text-medium-emphasis"
    >
      {{ user.person.fullName }} · {{ user.email }}
    </div>
    <div
      v-if="descriptor.enabledNote"
      class="text-body-small text-medium-emphasis w-100"
    >
      {{ descriptor.enabledNote }}
    </div>
    <VSpacer />
    <AUserManageButton
      v-if="showManage && manageTarget"
      :target="manageTarget"
      :system-label="label"
    />
    <AUserCreateInSystemButton
      v-if="showCreate"
      :system-label="label"
      :create-note="descriptor.createNote"
      :will-be-enabled="createEnabled"
      :loading="creating"
      :required-metadata="descriptor.requiredMetadata"
      :user-id="userId"
      :source="source"
      @confirm="(user) => emit('create', descriptor, user)"
    />
    <VBtn
      v-if="canRetry"
      size="small"
      variant="text"
      data-cy="user-system-retry"
      @click="run"
    >
      {{ t('common.userSystem.button.retry') }}
    </VBtn>
  </div>
</template>
