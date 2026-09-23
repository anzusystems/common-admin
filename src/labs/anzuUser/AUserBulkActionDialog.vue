<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import AUserSystemStatusChip from '@/labs/anzuUser/AUserSystemStatusChip.vue'
import {
  BulkAction,
  BulkOutcome,
  useUserCrossSystemStore,
  type BulkActionType,
} from '@/labs/anzuUser/userCrossSystemStore'
import type { AnyUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'
import { isActionable, UserSystemAccess } from '@/labs/anzuUser/userSystemState'
import { isUndefined } from '@/utils/common'

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
/** The dialog shows the list first and the log after the operator confirms. */
const showingLog = ref(false)

interface Row {
  descriptor: AnyUserSystemDescriptor
  selectable: boolean
  reason: string | null
}

/**
 * Which systems can be ticked, decided by the probe and not by ACL.
 *
 * This is a cross-system surface: no current user is loaded for the other backends, so `<Acl>`
 * would return false everywhere and quietly tick nothing. Not selectable are the systems the probe
 * can speak for -- 403, 404, switched off in configuration -- plus the ones that did not answer at
 * all, because acting on those would be a guess. "May read but may not write" cannot be seen from
 * here and ends up as a 403 in the log.
 */
const rows = computed<Row[]>(() =>
  props.descriptors.map((descriptor) => {
    const result = store.results.get(descriptor.system)
    if (!descriptor.isEnabled()) {
      return { descriptor, selectable: false, reason: t('common.userSystem.state.configDisabled') }
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
    // Already where the action would take it. A no-op PUT would still run `updateRelations()` in
    // cms over seven scalars and twelve collections -- risk for nothing.
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

// Everything that can be acted on, ticked. Blog and forum included: in practice a departing
// employee is switched off there too in almost every case, so leaving them out would mean an extra
// click nearly always. The note in their row stays -- as information, not as a reason to untick.
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
 * This run's lines only.
 *
 * The log outlives a run on purpose, so without the filter the dialog would show a metadata repair's
 * failures and offer to retry them -- as an enable or a disable, against whichever account is on
 * screen now.
 */
const currentLog = computed(() =>
  store.bulkLog.filter((entry) => entry.action === props.action && entry.subjectId === store.resolvedId)
)

const failed = computed(() =>
  currentLog.value.filter((entry) => entry.outcome !== BulkOutcome.Done && entry.outcome !== BulkOutcome.Pending)
)

const run = () => {
  showingLog.value = true
  emit('run', [...selected.value])
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
      <ADialogToolbar @on-cancel="open = false">
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
          `polite`, never `assertive`: nine systems finishing one after another would flood a screen
          reader. Focus deliberately stays where it is when the dialog switches to this view.
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
          :disabled="selected.length === 0 || !!store.identityConflict"
          data-cy="user-bulk-confirm"
          @click.stop="run"
        >
          {{ t(confirmKey, { count: selected.length }, selected.length) }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
