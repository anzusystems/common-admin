<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AUserCreateInSystemButton from '@/domains/anzuUser/components/AUserCreateInSystemButton.vue'
import AUserManageButton from '@/domains/anzuUser/components/AUserManageButton.vue'
import AUserSystemStatusChip from '@/domains/anzuUser/components/AUserSystemStatusChip.vue'
import { type AnyUserSystemDescriptor, descriptorMayWrite } from '@/domains/anzuUser/composables/userSystemDescriptor'
import { useUserSystemProbe, UserSystemRefreshHookKey } from '@/domains/anzuUser/composables/userSystemProbe'
import { isAuthoritativelyAbsent, UserSystemAccess, UserSystemLoad } from '@/domains/anzuUser/utils/userSystemState'
import type { BaseUser } from '@/shared/types/AnzuUser'
import type { IntegerId } from '@/shared/types/common'
import { isUndefined } from '@/shared/utils/common'

const props = withDefaults(
  defineProps<{
    descriptor: AnyUserSystemDescriptor
    userId: IntegerId
    /**
     * On a viewing page there is no Create, because no read-only screen offers a write action.
     * Manage stays because it only navigates.
     */
    readonly?: boolean
    /**
     * Whether the account about to be created would be switched on.
     */
    createEnabled?: boolean
    /**
     * What the owning system holds, to prefill the create form.
     */
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
 * The buttons depend on the probe's answer, not on `<Acl>`, except that the descriptor can deny writing (`canWrite`).
 * On a cross-system surface no current user is loaded for other backends, so `can()` would throw and
 * `<Acl>` would render nothing. The probe is the only signal, so its 401 handling must be right.
 */
const showManage = computed(
  () =>
    axes.value.load === UserSystemLoad.Loaded &&
    user.value !== null &&
    !isUndefined(props.descriptor.manage) &&
    descriptorMayWrite(props.descriptor, 'update')
)
const showCreate = computed(
  () => !props.readonly && isAuthoritativelyAbsent(axes.value) && descriptorMayWrite(props.descriptor, 'create')
)

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

// The panel is never re-created because `VWindowItem` hides it
// with `v-show`. A new id has to reach it through this watcher.
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
