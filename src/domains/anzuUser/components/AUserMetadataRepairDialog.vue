<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useI18n } from 'vue-i18n'
import ADialogToolbar from '@/domains/ui/components/ADialogToolbar.vue'
import AUserMetadataForm from '@/domains/anzuUser/components/AUserMetadataForm.vue'
import AUserSystemStatusChip from '@/domains/anzuUser/components/AUserSystemStatusChip.vue'
import { type AnyUserSystemDescriptor, descriptorMayWrite } from '@/domains/anzuUser/composables/userSystemDescriptor'
import {
  pickPrefillSource,
  readMetadataField,
  systemsNeedingWrite,
  USER_METADATA_FIELDS,
} from '@/domains/anzuUser/utils/userMetadataDiff'
import { BulkAction, BulkOutcome, useUserCrossSystemStore } from '@/domains/anzuUser/store/userCrossSystemStore'
import type { BaseUser } from '@/shared/types/AnzuUser'
import { cloneDeep, isUndefined } from '@/shared/utils/common'

const props = defineProps<{
  descriptors: AnyUserSystemDescriptor[]
}>()

const emit = defineEmits<{
  (e: 'confirm', payload: { target: BaseUser; systems: string[] }): void
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const store = useUserCrossSystemStore()

// The form's own collector, so the strict rules are checked before writing. Without it an empty
// name or colour from the source (common in blog and cms) was written blank to every ticked system.
const v$ = useVuelidate()

const records = computed(() => {
  const map = new Map<string, BaseUser>()
  for (const descriptor of props.descriptors) {
    const user = store.results.get(descriptor.system)?.user
    if (user) map.set(descriptor.system, user)
  }
  return map
})

const sourceSystem = ref<string | null>(null)
const target = ref<BaseUser | null>(null)
/**
 * Target systems. Ticked by default and untickable one by one, like the enable/disable
 * dialog, so an operator can skip a system whose value is intentionally different.
 */
const selected = ref<string[]>([])
/**
 * The dialog stays open after confirm and shows the run, like the enable/disable one.
 * Closing on confirm hid failures: a 422 on one system looked like a successful repair.
 */
const showingLog = ref(false)

/**
 * Pre-fill from the first system in configured order that has a record, not
 * the first to answer. The fan-out is parallel, so that would differ per run.
 * The source is shown and can be changed.
 */
watch(
  open,
  (value) => {
    if (!value) return
    showingLog.value = false
    const order = props.descriptors.map((descriptor) => descriptor.system)
    sourceSystem.value = pickPrefillSource(order, records.value)
    const source = sourceSystem.value === null ? undefined : records.value.get(sourceSystem.value)
    target.value = isUndefined(source)
      ? null
      : cloneDeep({ id: source.id, email: source.email, person: source.person, avatar: source.avatar })
  },
  { immediate: true }
)

watch(sourceSystem, (system) => {
  if (system === null) return
  const source = records.value.get(system)
  if (isUndefined(source)) return
  target.value = cloneDeep({ id: source.id, email: source.email, person: source.person, avatar: source.avatar })
})

const sourceOptions = computed(() =>
  props.descriptors
    .filter((descriptor) => records.value.has(descriptor.system))
    .map((descriptor) => ({ value: descriptor.system, title: descriptor.label ?? descriptor.system }))
)

const mayUpdate = (system: string) => {
  const descriptor = props.descriptors.find((item) => item.system === system)
  return isUndefined(descriptor) || descriptorMayWrite(descriptor, 'update')
}

const allDiffering = computed(() => (target.value === null ? [] : systemsNeedingWrite(target.value, records.value)))

/** Only systems whose value differs and that may be written. */
const differing = computed(() => allDiffering.value.filter(mayUpdate))

/** Differing, but the operator may not write them: listed so the repair does not look complete. */
const differingWithoutRight = computed(() => allDiffering.value.filter((system) => !mayUpdate(system)))

const affected = computed(() => differing.value.filter((system) => selected.value.includes(system)))

// Re-tick everything that differs whenever the set changes: on open and on a source switch.
watch(
  differing,
  (systems) => {
    selected.value = [...systems]
  },
  { immediate: true }
)

const changes = computed(() => {
  if (target.value === null) return []
  return differing.value.flatMap((system) => {
    const current = records.value.get(system)
    if (isUndefined(current)) return []
    return USER_METADATA_FIELDS.filter(
      (field) => readMetadataField(current, field) !== readMetadataField(target.value as BaseUser, field)
    ).map((field) => ({
      system,
      field,
      from: readMetadataField(current, field),
      to: readMetadataField(target.value as BaseUser, field),
    }))
  })
})

const currentLog = computed(() =>
  store.bulkLog.filter((entry) => entry.action === BulkAction.Metadata && entry.subjectId === store.resolvedId)
)

const failed = computed(() =>
  currentLog.value.filter((entry) => entry.outcome !== BulkOutcome.Done && entry.outcome !== BulkOutcome.Pending)
)

const noteFor = (system: string) => props.descriptors.find((item) => item.system === system)?.metadataNote

const labelFor = (system: string) => props.descriptors.find((item) => item.system === system)?.label ?? system

const confirm = async () => {
  if (target.value === null || store.identityConflict !== null || affected.value.length === 0) return
  // Strict because it writes to up to nine places: only a value that passes in every system may go.
  if (!(await v$.value.$validate())) return
  showingLog.value = true
  emit('confirm', { target: target.value, systems: affected.value })
}

/** Retries the same value on systems it did not reach, 403 included: rights may have been granted since. */
const retryFailed = () => {
  if (target.value === null) return
  emit('confirm', { target: target.value, systems: failed.value.map((entry) => entry.system) })
}
</script>

<template>
  <VDialog
    v-model="open"
    :max-width="900"
    data-cy="user-metadata-repair-dialog"
  >
    <VCard>
      <ADialogToolbar @cancel="open = false">
        {{ t('common.userSystem.repair.title') }}
      </ADialogToolbar>
      <VCardText v-if="target && !showingLog">
        <!--
          Two ids share one e-mail. Writing under either could put this person's
          metadata on someone else's account, and no admin can delete an AnzuUser.
        -->
        <VAlert
          v-if="store.identityConflict"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
          data-cy="repair-identity-conflict"
        >
          {{ t('common.userSystem.search.identityConflict') }}
        </VAlert>
        <VSelect
          v-model="sourceSystem"
          :items="sourceOptions"
          :label="t('common.userSystem.repair.source')"
          density="compact"
          data-cy="repair-source"
        />
        <!--
          Always strict, whatever the target profiles say. It writes to many systems, and a loose
          form could put an empty name into cms, which cms's form would then refuse to save.
          `randomColor` is deliberately not passed: the strict form would
          invent a colour on open and mark it as a change everywhere.
        -->
        <AUserMetadataForm
          v-model:user="target"
          required
          :id-input="false"
          is-edit
        />
        <div class="mt-4 text-label-large">{{ t('common.userSystem.repair.changes') }}</div>
        <div
          v-for="system in differing"
          :key="system"
          class="mt-2 d-flex align-start ga-2"
        >
          <VCheckbox
            v-model="selected"
            :value="system"
            :disabled="!!store.identityConflict"
            :data-cy="`repair-system-${system}`"
            density="compact"
            hide-details
          />
          <div>
            <div class="d-flex align-center ga-2">
              <span class="font-weight-medium">{{ labelFor(system) }}</span>
              <AUserSystemStatusChip
                v-if="store.results.get(system)"
                :axes="store.results.get(system)!.axes"
              />
            </div>
            <div
              v-if="noteFor(system)"
              class="text-body-small text-warning"
            >
              {{ noteFor(system) }}
            </div>
            <div
              v-for="change in changes.filter((item) => item.system === system)"
              :key="change.field"
              class="text-body-small"
            >
              {{ change.field }}: <s>{{ change.from || '—' }}</s> → {{ change.to || '—' }}
            </div>
          </div>
        </div>
        <div
          v-for="system in differingWithoutRight"
          :key="system"
          class="mt-2 d-flex align-center ga-2"
          :data-cy="`repair-system-no-right-${system}`"
        >
          <VCheckbox
            :model-value="false"
            disabled
            density="compact"
            hide-details
          />
          <span class="font-weight-medium">{{ labelFor(system) }}</span>
          <span class="text-body-small text-medium-emphasis">{{ t('common.userSystem.state.noWriteRight') }}</span>
        </div>
      </VCardText>
      <VCardText v-else-if="showingLog">
        <div class="text-label-large mb-2">{{ t('common.userSystem.bulk.log') }}</div>
        <!-- `polite`: nine systems finishing one after another would flood a screen reader. -->
        <div
          aria-live="polite"
          data-cy="repair-log"
        >
          <div
            v-for="entry in currentLog"
            :key="entry.system"
            class="d-flex align-center ga-2 py-1"
          >
            <div class="font-weight-medium">{{ labelFor(entry.system) }}</div>
            <div class="text-body-small">{{ t(`common.userSystem.bulk.outcome.${entry.outcome}`) }}</div>
            <div
              v-if="entry.detail"
              class="text-body-small text-warning"
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
          data-cy="repair-retry"
          @click.stop="retryFailed"
        >
          {{ t('common.userSystem.bulk.retryFailed') }}
        </ABtnTertiary>
        <ABtnPrimary
          v-if="!showingLog"
          :disabled="affected.length === 0 || !!store.identityConflict"
          data-cy="repair-confirm"
          @click.stop="confirm"
        >
          {{ t('common.userSystem.bulk.metadata.confirm', { count: affected.length }, affected.length) }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
