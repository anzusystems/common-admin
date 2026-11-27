<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ADialogToolbar from '@/domains/ui/components/ADialogToolbar.vue'
import AUserSystemStatusChip from '@/domains/anzuUser/components/AUserSystemStatusChip.vue'
import {
  BulkAction,
  BulkOutcome,
  useUserCrossSystemStore,
  type BulkActionType,
} from '@/domains/anzuUser/store/userCrossSystemStore'
import { type AnyUserSystemDescriptor, descriptorMayWrite } from '@/domains/anzuUser/composables/userSystemDescriptor'
import { isActionable, UserSystemAccess } from '@/domains/anzuUser/utils/userSystemState'
import { isUndefined } from '@/shared/utils/common'

const props = defineProps<{
  action: BulkActionType
  descriptors: AnyUserSystemDescriptor[]
}>()

const emit = defineEmits<{
  (e: 'run', systems: string[]): void
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const store = useUserCrossSystemStore()

const selected = ref<string[]>([])
const showingLog = ref(false)

interface Row {
  descriptor: AnyUserSystemDescriptor
  selectable: boolean
  reason: string | null
}

/**
 * Which systems can be ticked is decided by the probe, not by ACL.
 * No current user is loaded for the other backends, so `<Acl>` would return false everywhere.
 * Not selectable: systems the probe reports as 403, 404 or switched off, and systems that did not answer.
 * Read-but-not-write cannot be seen here and ends up as a 403 in the log.
 */
const rows = computed<Row[]>(() =>
  props.descriptors.map((descriptor) => {
    const result = store.results.get(descriptor.system)
    if (!descriptor.isEnabled()) {
      return { descriptor, selectable: false, reason: t('common.userSystem.state.configDisabled') }
    }
    if (!descriptorMayWrite(descriptor, 'update')) {
      return { descriptor, selectable: false, reason: t('common.userSystem.state.noWriteRight') }
    }
    if (isUndefined(result) || !isActionable(result.axes)) {
      const access = result?.axes.access
      const reason =
        access === UserSystemAccess.Forbidden
          ? t('common.userSystem.state.forbidden')
          : access === UserSystemAccess.Ok
            ? t('common.userSystem.state.absent')
            : t('common.userSystem.state.unavailable')
      return { descriptor, selectable: false, reason }
    }
    // Already in the target state. A no-op PUT would still run `updateRelations()` in cms over many fields, so skip it.
    if (props.action === BulkAction.Enable && result.axes.enabled === true) {
      return { descriptor, selectable: false, reason: t('common.userSystem.bulk.alreadyInState') }
    }
    if (props.action === BulkAction.Disable && result.axes.enabled === false) {
      return { descriptor, selectable: false, reason: t('common.userSystem.bulk.alreadyInState') }
    }
    return { descriptor, selectable: true, reason: null }
  })
)

const selectableSystems = computed(() => rows.value.filter((row) => row.selectable).map((row) => row.descriptor.system))

// Tick everything actionable, blog and forum included. A departing employee is almost always switched off there too.
// Their row note stays as information, not as a reason to untick.
watch(
  open,
  (value) => {
    if (!value) return
    showingLog.value = false
    selected.value = [...selectableSystems.value]
  },
  { immediate: true }
)

const titleKey = computed(() => `common.userSystem.bulk.${props.action}.title`)
const confirmKey = computed(() => `common.userSystem.bulk.${props.action}.confirm`)

/**
 * Only this run's entries. The log outlives a run, so without the filter the dialog would offer
 * to retry other actions' failures, such as a metadata repair, against the account on screen.
 */
const currentLog = computed(() =>
  store.bulkLog.filter((entry) => entry.action === props.action && entry.subjectId === store.resolvedId)
)

const failed = computed(() =>
  currentLog.value.filter((entry) => entry.outcome !== BulkOutcome.Done && entry.outcome !== BulkOutcome.Pending)
)

// Re-check selectability: a right may have been granted or revoked while the dialog was open.
const actionable = computed(() => selected.value.filter((system) => selectableSystems.value.includes(system)))

const run = () => {
  if (actionable.value.length === 0) return
  showingLog.value = true
  emit('run', actionable.value)
}

/** Retries everything that failed, 403 included: the operator may have been granted the right meanwhile. */
const retryFailed = () => {
  emit(
    'run',
    failed.value.map((entry) => entry.system)
  )
}

const labelFor = (descriptor: AnyUserSystemDescriptor) => descriptor.label ?? descriptor.system
</script>

<template>
  <VDialog
    v-model="open"
    :max-width="720"
    data-cy="user-bulk-dialog"
  >
    <VCard>
      <!-- Closing while the calls are still going is allowed; the run lives in the store. -->
      <ADialogToolbar @cancel="open = false">
        {{ t(titleKey) }}
      </ADialogToolbar>
      <VCardText v-if="!showingLog">
        <VAlert
          v-if="store.identityConflict"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ t('common.userSystem.search.identityConflict') }}
        </VAlert>
        <div
          v-for="row in rows"
          :key="row.descriptor.system"
          class="d-flex align-center ga-2 py-1"
        >
          <VCheckbox
            v-model="selected"
            :value="row.descriptor.system"
            :disabled="!row.selectable || !!store.identityConflict"
            :data-cy="`bulk-system-${row.descriptor.system}`"
            density="compact"
            hide-details
          />
          <div class="font-weight-medium">{{ labelFor(row.descriptor) }}</div>
          <AUserSystemStatusChip
            v-if="store.results.get(row.descriptor.system)"
            :axes="store.results.get(row.descriptor.system)!.axes"
          />
          <div
            v-if="row.reason"
            class="text-body-small text-medium-emphasis"
          >
            {{ row.reason }}
          </div>
          <div
            v-if="row.descriptor.enabledNote && action !== BulkAction.Metadata"
            class="text-body-small text-warning w-100"
          >
            {{ row.descriptor.enabledNote }}
          </div>
          <div
            v-if="row.descriptor.metadataNote && action === BulkAction.Metadata"
            class="text-body-small text-warning w-100"
          >
            {{ row.descriptor.metadataNote }}
          </div>
        </div>
      </VCardText>
      <VCardText v-else>
        <div class="text-label-large mb-2">{{ t('common.userSystem.bulk.log') }}</div>
        <!--
          `polite`, not `assertive`: nine systems finishing in sequence would flood a screen reader.
          Focus deliberately stays put when the dialog switches to this view.
        -->
        <div
          aria-live="polite"
          data-cy="user-bulk-log"
        >
          <div
            v-for="entry in currentLog"
            :key="entry.system"
            class="d-flex align-center ga-2 py-1"
          >
            <div class="font-weight-medium">{{ entry.system }}</div>
            <div class="text-body-small">{{ t(`common.userSystem.bulk.outcome.${entry.outcome}`) }}</div>
            <div
              v-if="entry.detail"
              class="text-body-small text-medium-emphasis"
            >
              {{ entry.detail }}
            </div>
          </div>
        </div>
      </VCardText>
      <VCardActions>
        <ABtnTertiary @click.stop="open = false">
          {{ showingLog ? t('common.userSystem.bulk.close') : t('common.button.cancel') }}
        </ABtnTertiary>
        <VSpacer />
        <ABtnTertiary
          v-if="showingLog && failed.length > 0 && !store.bulkRunning"
          data-cy="user-bulk-retry"
          @click.stop="retryFailed"
        >
          {{ t('common.userSystem.bulk.retryFailed') }}
        </ABtnTertiary>
        <ABtnPrimary
          v-if="!showingLog"
          :disabled="actionable.length === 0 || !!store.identityConflict"
          data-cy="user-bulk-confirm"
          @click.stop="run"
        >
          {{ t(confirmKey, { count: actionable.length }, actionable.length) }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
