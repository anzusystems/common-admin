<script lang="ts" setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useI18n } from 'vue-i18n'
import ADialogToolbar from '@/domains/ui/components/ADialogToolbar.vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useAnzuUserFactory } from '@/domains/anzuUser/factory/AnzuUserFactory'
import AUserBulkActionDialog from '@/domains/anzuUser/components/AUserBulkActionDialog.vue'
import AUserCreateInSystemButton from '@/domains/anzuUser/components/AUserCreateInSystemButton.vue'
import AUserManageButton from '@/domains/anzuUser/components/AUserManageButton.vue'
import AUserMetadataForm from '@/domains/anzuUser/components/AUserMetadataForm.vue'
import AUserMetadataRepairDialog from '@/domains/anzuUser/components/AUserMetadataRepairDialog.vue'
import AUserSystemStatusChip from '@/domains/anzuUser/components/AUserSystemStatusChip.vue'
import {
  BulkAction,
  BulkOutcome,
  CrossSystemPhase,
  useUserCrossSystemStore,
  type BulkActionType,
  type BulkOutcomeType,
} from '@/domains/anzuUser/store/userCrossSystemStore'
import { isEmailTerm, useUserCrossSystemSearch } from '@/domains/anzuUser/composables/userCrossSystemSearch'
import { useUserCrossSystemWrites } from '@/domains/anzuUser/composables/userCrossSystemWrites'
import { findMetadataDifferences, type UserMetadataField } from '@/domains/anzuUser/utils/userMetadataDiff'
import { type AnyUserSystemDescriptor, descriptorMayWrite } from '@/domains/anzuUser/composables/userSystemDescriptor'
import type { UserSystemRefreshHook } from '@/domains/anzuUser/composables/userSystemProbe'
import { isActionable } from '@/domains/anzuUser/utils/userSystemState'
import type { AnzuUser, BaseUser } from '@/shared/types/AnzuUser'
import { cloneDeep, isNull, isUndefined } from '@/shared/utils/common'

const props = defineProps<{
  /** Order matters twice: the order of the rows, and the priority when pre-filling. */
  descriptors: AnyUserSystemDescriptor[]
  refreshHook?: UserSystemRefreshHook | undefined
}>()

const emit = defineEmits<{
  (e: 'searched', term: string): void
}>()

const { t } = useI18n()
const { showError } = useAlerts()
const store = useUserCrossSystemStore()
const { createAnzuUser } = useAnzuUserFactory()
const writes = useUserCrossSystemWrites()

// Collector for the metadata form in the create dialog. Without it the rules register
// on some ancestor, and the dialog cannot validate the fields before sending.
const v$ = useVuelidate()

/* eslint-disable vue/no-setup-props-reactivity-loss */
const { search, refreshSystem, unresolvedSystems, cancel } = useUserCrossSystemSearch({
  descriptors: props.descriptors,
  refreshHook: props.refreshHook,
})
/* eslint-enable vue/no-setup-props-reactivity-loss */

const term = ref('')
const rowBusy = ref(new Set<string>())

const runSearch = async () => {
  const value = term.value.trim()
  if (value.length === 0) return
  emit('searched', value)
  await search(value)
}

const records = computed(() => {
  const map = new Map<string, BaseUser>()
  for (const descriptor of props.descriptors) {
    const user = store.results.get(descriptor.system)?.user
    if (user) map.set(descriptor.system, user)
  }
  return map
})

const differences = computed(() => findMetadataDifferences(records.value))

const foundAnywhere = computed(() => records.value.size > 0)

/** Bulk actions only write where the person was found, so offer them when at least one of those systems is writable. */
const anyFoundWritable = computed(() =>
  props.descriptors.some((item) => records.value.has(item.system) && descriptorMayWrite(item, 'update'))
)
const searchDone = computed(() => store.phase === CrossSystemPhase.Done)

const searchedByEmail = computed(() => isEmailTerm(store.searchTerm))

/**
 * When to offer creating an account after a search that found nobody.
 * By id: only if every relevant probe returned an authoritative 404. An
 * unreadable record may exist, and a duplicate identity cannot be deleted.
 * By e-mail: always. An address search cannot prove absence, and the dialog
 * asks for the id and runs its own authoritative check before writing.
 * Refusing here would block the decision 21 flow for the search people actually use, since they do not know the id yet.
 */
const canOfferCreateAnywhere = computed(
  () =>
    searchDone.value &&
    !foundAnywhere.value &&
    (searchedByEmail.value || unresolvedSystems.value.length === 0) &&
    props.descriptors.some((item) => item.isEnabled() && descriptorMayWrite(item, 'create'))
)

/** A conflict is not a state to act from: writes would land on somebody else's account. */
const blockedByConflict = computed(() => store.identityConflict !== null)

const labelFor = (descriptor: AnyUserSystemDescriptor) => descriptor.label ?? descriptor.system

const manageTargetFor = (descriptor: AnyUserSystemDescriptor) => {
  const user = store.results.get(descriptor.system)?.user
  if (isUndefined(user) || isNull(user) || isUndefined(descriptor.manage)) return null
  return descriptor.manage(user)
}

const extraStateFor = (descriptor: AnyUserSystemDescriptor) => {
  const user = store.results.get(descriptor.system)?.user
  if (isUndefined(user) || isNull(user) || isUndefined(descriptor.extraState)) return null
  return descriptor.extraState(user)
}

const EXTRA_STATE_COLOR = { ok: 'success', warn: 'warning', error: 'error' } as const

/**
 * Report a failed row action to the user.
 * Without this a 403 on Vypnúť leaves a spinner and an unchanged row, because the api helpers only write to the logger.
 */
const reportOutcome = (label: string, outcome: BulkOutcomeType) => {
  if (outcome === BulkOutcome.Done) return
  showError(label + ': ' + t('common.userSystem.bulk.outcome.' + outcome))
}

const detailFor = (fields: UserMetadataField[] | undefined) =>
  isUndefined(fields) || fields.length === 0
    ? undefined
    : t('common.userSystem.bulk.concurrentChange', { fields: fields.join(', ') })

const withRowBusy = async (system: string, run: () => Promise<void>) => {
  rowBusy.value = new Set([...rowBusy.value, system])
  try {
    await run()
  } finally {
    const next = new Set(rowBusy.value)
    next.delete(system)
    rowBusy.value = next
  }
}

/** The touched row is read again after every write. Otherwise it keeps showing the old state. */
const toggleOne = async (descriptor: AnyUserSystemDescriptor, enabled: boolean) => {
  const id = store.resolvedId
  if (isNull(id)) return
  await withRowBusy(descriptor.system, async () => {
    const result = await writes.setEnabled(descriptor, id, enabled)
    reportOutcome(labelFor(descriptor), result.outcome)
    await refreshSystem(descriptor.system)
  })
}

const createFromSource = async (descriptor: AnyUserSystemDescriptor, metadata: BaseUser) => {
  const id = store.resolvedId
  if (isNull(id)) return
  const sourceSystem = props.descriptors.find((item) => records.value.has(item.system))
  if (isUndefined(sourceSystem)) return

  await withRowBusy(descriptor.system, async () => {
    // Read from the server, never from search results or a form's store.
    // An unsaved switch would otherwise be copied into a system where it means a working public account.
    const source = await writes.readSourceUser(sourceSystem, id)
    if (isNull(source)) {
      showError(t('common.userSystem.create.sourceUnreadable', { system: labelFor(sourceSystem) }))
      return
    }
    // The dialog already told the operator whether the account will be switched on, based on the search result.
    // If the server disagrees now, someone changed it. In blog and forum that means a working public account.
    if (source.enabled !== sourceEnabled.value) {
      // Re-read instead of patching the record. The chip uses the probe's axes, so
      // replacing only the user leaves the chip stale next to an updated toggle.
      await refreshSystem(sourceSystem.system)
      showError(t('common.userSystem.create.sourceChanged'))
      return
    }
    // The create right may have been lost while the source was read. Nothing is offered then, so nothing is reported.
    if (!descriptorMayWrite(descriptor, 'create')) return
    // Metadata comes from the dialog, which was validated against the target's profile.
    // The source may leave `person` empty (blog never fills it) where the target requires it.
    const body = createAnzuUser(descriptor.system)
    body.id = source.id
    body.email = metadata.email
    body.person = cloneDeep(metadata.person)
    body.avatar = cloneDeep(metadata.avatar)
    // Copying a person into another system copies whether they are switched on. Roles stay empty.
    body.enabled = source.enabled
    const result = await writes.createInSystem(descriptor, body)
    reportOutcome(labelFor(descriptor), result.outcome)
    await refreshSystem(descriptor.system)
  })
}

/** The record the create form is prefilled from: the first configured system that has one. */
const prefillSource = computed(() => {
  const first = props.descriptors.find((item) => records.value.has(item.system))
  return isUndefined(first) ? null : (records.value.get(first.system) ?? null)
})

const sourceEnabled = computed(() => {
  const first = props.descriptors.find((item) => records.value.has(item.system))
  if (isUndefined(first)) return false
  return store.results.get(first.system)?.user?.enabled === true
})

const bulkOpen = ref(false)
const bulkAction = ref<BulkActionType>(BulkAction.Disable)
const repairOpen = ref(false)

const openBulk = (action: BulkActionType) => {
  bulkAction.value = action
  bulkOpen.value = true
}

/** Every bulk write passes through here, retries included. A system the descriptor refuses is not written. */
const writableSystems = (systems: string[]) =>
  systems.filter((system) => {
    const descriptor = props.descriptors.find((item) => item.system === system)
    return !isUndefined(descriptor) && descriptorMayWrite(descriptor, 'update')
  })

const runBulk = async (requested: string[]) => {
  const id = store.resolvedId
  if (isNull(id)) return
  const systems = writableSystems(requested)
  if (systems.length === 0) return
  const enabled = bulkAction.value === BulkAction.Enable
  store.startBulk(bulkAction.value, systems, id)
  await Promise.allSettled(
    systems.map(async (system) => {
      const descriptor = props.descriptors.find((item) => item.system === system)
      if (isUndefined(descriptor)) return
      store.setBulkEntry(system, BulkOutcome.Running)
      const result = await writes.setEnabled(descriptor, id, enabled)
      store.setBulkEntry(system, result.outcome)
      await refreshSystem(system)
    })
  )
  store.finishBulk()
}

const runRepair = async (payload: { target: BaseUser; systems: string[] }) => {
  const id = store.resolvedId
  if (isNull(id)) return
  const systems = writableSystems(payload.systems)
  if (systems.length === 0) return
  store.startBulk(BulkAction.Metadata, systems, id)
  // Captured before any write, so the comparison uses the values the operator saw, not a row a sibling write refreshed.
  const seenBefore = new Map(records.value)
  await Promise.allSettled(
    systems.map(async (system) => {
      const descriptor = props.descriptors.find((item) => item.system === system)
      if (isUndefined(descriptor)) return
      store.setBulkEntry(system, BulkOutcome.Running)
      const result = await writes.writeMetadata(
        descriptor,
        id,
        payload.target,
        undefined,
        seenBefore.get(system) ?? null
      )
      store.setBulkEntry(system, result.outcome, detailFor(result.concurrentFields))
      await refreshSystem(system)
    })
  )
  store.finishBulk()
}

const createAnywhereOpen = ref(false)
const createAnywhereSystem = ref<string | null>(null)
const createAnywhereUser = ref<AnzuUser>(createAnzuUser())
const createAnywhereChecking = ref(false)
const createAnywhereConflict = ref<string[]>([])
const createAnywhereError = ref<string | null>(null)

/** Set when the page goes away, so work that finishes afterwards does not refill it. */
let left = false

const openCreateAnywhere = () => {
  // Pick the first enabled system, not the first listed. A system disabled in the configuration
  // is not an option, and preselecting it would POST through a client with no base URL.
  createAnywhereSystem.value =
    props.descriptors.find((item) => item.isEnabled() && descriptorMayWrite(item, 'create'))?.system ?? null
  createAnywhereUser.value = createAnzuUser(createAnywhereSystem.value ?? '')
  createAnywhereConflict.value = []
  createAnywhereError.value = null
  createAnywhereOpen.value = true
}

/**
 * Before creating, the typed id is looked up across the systems.
 * cms, dam and contentHub skip the SSO lookup for a numeric id, and the validators check id and e-mail separately. A
 * typo would create an account with one person's id and another's e-mail, and later fan-outs follow the wrong identity.
 * If a probe answers 401, 403 or nothing, creating is blocked, because the id's owner is unknown.
 */
const confirmCreateAnywhere = async () => {
  const id = createAnywhereUser.value.id
  const system = createAnywhereSystem.value
  createAnywhereConflict.value = []
  createAnywhereError.value = null
  if (isNull(system)) return
  // The id is checked here, not only by the form. A term the search refuses probes
  // nothing, and that empty result would read as "this id belongs to nobody".
  if (isNull(id) || isUndefined(id) || !Number.isInteger(id) || id <= 0) {
    createAnywhereError.value = t('common.userSystem.create.invalidId')
    return
  }
  if (!(await v$.value.$validate())) return
  createAnywhereChecking.value = true
  try {
    if (!(await search(String(id)))) {
      createAnywhereError.value = t('common.userSystem.create.invalidId')
      return
    }
    if (left) return
    if (records.value.size > 0) {
      createAnywhereConflict.value = [...records.value.keys()]
      return
    }
    if (unresolvedSystems.value.length > 0) {
      createAnywhereConflict.value = unresolvedSystems.value
      return
    }
    const descriptor = props.descriptors.find((item) => item.system === system)
    if (isUndefined(descriptor) || !descriptor.isEnabled() || !descriptorMayWrite(descriptor, 'create')) return
    const body = createAnzuUser(system)
    body.id = id
    body.email = createAnywhereUser.value.email
    body.person = cloneDeep(createAnywhereUser.value.person)
    body.avatar = cloneDeep(createAnywhereUser.value.avatar)
    // Nobody to copy from, so the account is created switched off, as on an ordinary new-user page.
    body.enabled = false
    const result = await writes.createInSystem(descriptor, body)
    reportOutcome(labelFor(descriptor), result.outcome)
    if (result.outcome !== BulkOutcome.Done) return
    // The dialog is not persistent, so the operator can navigate away while the POST is pending.
    // The following search takes a fresh generation that `cancel()`
    // cannot stop, and would refill the store the unmount just emptied.
    if (left) return
    createAnywhereOpen.value = false
    await search(String(id))
  } finally {
    createAnywhereChecking.value = false
  }
}

/**
 * Uses the chosen target's own profile, not a blanket strict one.
 * The repair dialog is strict because it writes to nine systems. This creates one account
 * in one system, and strict would demand an avatar colour that blog does not require.
 */
const createAnywhereRequiredMetadata = computed(
  () => props.descriptors.find((item) => item.system === createAnywhereSystem.value)?.requiredMetadata ?? true
)

/** What is special about an account in the chosen system. For blog and forum it is a public one. */
const createAnywhereNote = computed(
  () => props.descriptors.find((item) => item.system === createAnywhereSystem.value)?.createNote
)

const createSystemOptions = computed(() =>
  props.descriptors
    .filter((item) => item.isEnabled() && descriptorMayWrite(item, 'create'))
    .map((item) => ({ value: item.system, title: labelFor(item) }))
)

// The store exists so a closed dialog does not stop a running bulk action, not to keep a person across navigation.
// Without this reset, returning through the menu showed the last
// person's rows and live buttons under an empty search box.
onBeforeUnmount(() => {
  left = true
  cancel()
  store.reset()
})

defineExpose({
  search: async (value: string) => {
    term.value = value
    await runSearch()
  },
})
</script>

<template>
  <div>
    <VCard variant="flat">
      <VCardText>
        <div class="d-flex align-center ga-2">
          <VTextField
            v-model="term"
            :label="t('common.userSystem.search.label')"
            :hint="t('common.userSystem.search.hint')"
            persistent-hint
            density="compact"
            data-cy="cross-system-search"
            @keyup.enter="runSearch"
          />
          <ABtnPrimary
            data-cy="cross-system-search-submit"
            @click.stop="runSearch"
          >
            {{ t('common.userSystem.search.submit') }}
          </ABtnPrimary>
        </div>
        <!--
          The two rounds are named while they run. Between them a row is neither present nor absent.
          Showing "no account here" would invite a Create for an account that exists under another address.
        -->
        <div
          v-if="store.phase === CrossSystemPhase.MatchingEmail"
          class="text-body-small mt-2"
        >
          {{ t('common.userSystem.search.phase.matchingEmail') }}
        </div>
        <div
          v-else-if="store.phase === CrossSystemPhase.VerifyingById"
          class="text-body-small mt-2"
        >
          {{ t('common.userSystem.search.phase.verifyingById') }}
        </div>
      </VCardText>
    </VCard>

    <VAlert
      v-if="store.identityConflict"
      type="error"
      variant="tonal"
      density="compact"
      class="my-3"
      data-cy="identity-conflict"
    >
      {{ t('common.userSystem.search.identityConflict') }}
    </VAlert>

    <!-- Neither an address nor an id. The previous person's rows are gone, and this says why. -->
    <VAlert
      v-if="store.termRejected"
      type="warning"
      variant="tonal"
      density="compact"
      class="my-3"
      data-cy="cross-system-term-rejected"
    >
      {{ t('common.userSystem.search.termRejected') }}
    </VAlert>

    <VCard
      v-if="searchDone"
      variant="flat"
      class="mt-3"
    >
      <VCardText class="d-flex flex-column ga-3">
        <div
          v-for="descriptor in descriptors"
          :key="descriptor.system"
          class="d-flex align-center flex-wrap ga-2"
          :data-cy="`cross-system-row-${descriptor.system}`"
        >
          <div
            class="font-weight-medium"
            style="min-width: 8rem"
          >
            {{ labelFor(descriptor) }}
          </div>
          <AUserSystemStatusChip
            v-if="store.results.get(descriptor.system)"
            :axes="store.results.get(descriptor.system)!.axes"
          />
          <VChip
            v-if="extraStateFor(descriptor)"
            :color="EXTRA_STATE_COLOR[extraStateFor(descriptor)!.tone]"
            label
            size="small"
          >
            {{ extraStateFor(descriptor)!.label }}: {{ extraStateFor(descriptor)!.value }}
          </VChip>
          <div class="text-body-small text-medium-emphasis">
            {{ store.results.get(descriptor.system)?.user?.person.fullName }}
            <template v-if="store.results.get(descriptor.system)?.user">
              · {{ store.results.get(descriptor.system)?.user?.email }}
            </template>
          </div>
          <VSpacer />
          <template
            v-if="store.results.get(descriptor.system) && isActionable(store.results.get(descriptor.system)!.axes)"
          >
            <VBtn
              v-if="descriptorMayWrite(descriptor, 'update')"
              size="small"
              variant="text"
              :loading="rowBusy.has(descriptor.system)"
              :disabled="blockedByConflict"
              :data-cy="`cross-system-toggle-${descriptor.system}`"
              @click="toggleOne(descriptor, !store.results.get(descriptor.system)!.user!.enabled)"
            >
              {{
                store.results.get(descriptor.system)!.user!.enabled
                  ? t('common.userSystem.bulk.disable.title')
                  : t('common.userSystem.bulk.enable.title')
              }}
            </VBtn>
            <AUserManageButton
              v-if="manageTargetFor(descriptor) && descriptorMayWrite(descriptor, 'update')"
              :target="manageTargetFor(descriptor)!"
              :system-label="labelFor(descriptor)"
            />
          </template>
          <!--
            Create is offered only when the person exists somewhere. That is the only way their global id is known.
          -->
          <AUserCreateInSystemButton
            v-else-if="
              foundAnywhere &&
              store.results.get(descriptor.system) &&
              store.results.get(descriptor.system)!.axes.presence === 'absent' &&
              descriptorMayWrite(descriptor, 'create')
            "
            :system-label="labelFor(descriptor)"
            :create-note="descriptor.createNote"
            :will-be-enabled="sourceEnabled"
            :loading="rowBusy.has(descriptor.system)"
            :disabled="blockedByConflict"
            :required-metadata="descriptor.requiredMetadata"
            :user-id="store.resolvedId"
            :source="prefillSource"
            @confirm="(user) => createFromSource(descriptor, user)"
          />
        </div>
      </VCardText>
    </VCard>

    <VCard
      v-if="differences.length > 0"
      variant="flat"
      class="mt-3"
      data-cy="cross-system-differences"
    >
      <VCardText>
        <div class="text-label-large">{{ t('common.userSystem.inconsistency.title') }}</div>
        <div
          v-for="difference in differences"
          :key="difference.field"
          class="text-body-small"
        >
          <strong>{{ difference.field }}</strong>
          <span
            v-for="[system, systemValue] in difference.values"
            :key="system"
            class="ml-2"
          >
            {{ system }}: {{ systemValue || '—' }}
          </span>
        </div>
      </VCardText>
    </VCard>

    <div
      v-if="searchDone && foundAnywhere && anyFoundWritable"
      class="d-flex ga-2 mt-3"
    >
      <!-- All three open a dialog. None of them acts straight away. -->
      <ABtnTertiary
        :disabled="store.bulkRunning || blockedByConflict"
        data-cy="cross-system-bulk-disable"
        @click="openBulk(BulkAction.Disable)"
      >
        {{ t('common.userSystem.bulk.openDisable') }}
      </ABtnTertiary>
      <ABtnTertiary
        :disabled="store.bulkRunning || blockedByConflict"
        data-cy="cross-system-bulk-enable"
        @click="openBulk(BulkAction.Enable)"
      >
        {{ t('common.userSystem.bulk.openEnable') }}
      </ABtnTertiary>
      <ABtnTertiary
        :disabled="store.bulkRunning || blockedByConflict"
        data-cy="cross-system-bulk-metadata"
        @click="repairOpen = true"
      >
        {{ t('common.userSystem.bulk.openMetadata') }}
      </ABtnTertiary>
      <div
        v-if="store.bulkRunning"
        class="text-body-small align-self-center"
      >
        {{ t('common.userSystem.bulk.runningElsewhere') }}
      </div>
    </div>

    <VCard
      v-if="searchDone && !foundAnywhere"
      variant="flat"
      class="mt-3"
    >
      <VCardText>
        <div data-cy="cross-system-not-found">{{ t('common.userSystem.search.notFound') }}</div>
        <ABtnPrimary
          v-if="canOfferCreateAnywhere"
          class="mt-2"
          data-cy="cross-system-create-anywhere"
          @click="openCreateAnywhere"
        >
          {{ t('common.userSystem.search.createAnywhere') }}
        </ABtnPrimary>
        <!-- Not offered for want of a create right: then nothing is left unconfirmed to retry. -->
        <template v-else-if="!searchedByEmail && unresolvedSystems.length > 0">
          <div class="text-body-small mt-2">
            {{ t('common.userSystem.create.notAuthoritative', { systems: unresolvedSystems.join(', ') }) }}
          </div>
          <ABtnTertiary
            class="mt-2"
            data-cy="cross-system-retry-search"
            @click="runSearch"
          >
            {{ t('common.userSystem.button.retry') }}
          </ABtnTertiary>
        </template>
      </VCardText>
    </VCard>

    <AUserBulkActionDialog
      v-model:open="bulkOpen"
      :action="bulkAction"
      :descriptors="descriptors"
      @run="runBulk"
    />

    <AUserMetadataRepairDialog
      v-model:open="repairOpen"
      :descriptors="descriptors"
      @confirm="runRepair"
    />

    <VDialog
      v-model="createAnywhereOpen"
      :max-width="720"
    >
      <VCard>
        <ADialogToolbar @cancel="createAnywhereOpen = false">
          {{ t('common.userSystem.search.createAnywhere') }}
        </ADialogToolbar>
        <VCardText>
          <VSelect
            v-model="createAnywhereSystem"
            :items="createSystemOptions"
            :label="t('common.userSystem.table.system')"
            density="compact"
            data-cy="create-anywhere-system"
          />
          <!-- Id and e-mail are both asked for: the e-mail is required by the backend. -->
          <AUserMetadataForm
            v-model:user="createAnywhereUser"
            :required="createAnywhereRequiredMetadata"
            id-input
          />
          <p
            v-if="createAnywhereNote"
            class="mt-2"
          >
            {{ createAnywhereNote }}
          </p>
          <VAlert
            v-if="createAnywhereError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-2"
            data-cy="create-anywhere-error"
          >
            {{ createAnywhereError }}
          </VAlert>
          <VAlert
            v-if="createAnywhereConflict.length > 0"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-2"
            data-cy="create-anywhere-conflict"
          >
            {{ t('common.userSystem.create.notAuthoritative', { systems: createAnywhereConflict.join(', ') }) }}
          </VAlert>
          <p class="mt-2">{{ t('common.userSystem.create.note') }}</p>
          <p>{{ t('common.userSystem.create.willBeDisabled') }}</p>
        </VCardText>
        <VCardActions>
          <ABtnTertiary @click.stop="createAnywhereOpen = false">
            {{ t('common.button.cancel') }}
          </ABtnTertiary>
          <VSpacer />
          <ABtnPrimary
            :loading="createAnywhereChecking"
            data-cy="create-anywhere-confirm"
            @click.stop="confirmCreateAnywhere"
          >
            {{ t('common.button.confirm') }}
          </ABtnPrimary>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
