<script lang="ts" setup>
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAlerts } from '@/composables/system/alerts'
import { useAnzuUserFactory } from '@/model/factory/AnzuUserFactory'
import { cloneDeep, isNull, isUndefined } from '@/utils/common'
import { BulkOutcome } from '@/labs/anzuUser/userCrossSystemStore'
import { useUserCrossSystemWrites } from '@/labs/anzuUser/userCrossSystemWrites'
import AUnsavedConfirmDialog from '@/labs/unsavedGuard/AUnsavedConfirmDialog.vue'
import { useUnsavedChangesGuard } from '@/labs/unsavedGuard/useUnsavedChangesGuard'
import AUserOtherSystemsTable from '@/labs/anzuUser/AUserOtherSystemsTable.vue'
import AUserSystemPanel from '@/labs/anzuUser/AUserSystemPanel.vue'
import type { AnyUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'
import type { AnzuUser, BaseUser } from '@/types/AnzuUser'
import type { IntegerId } from '@/types/common'
import { UserSystemRefreshHookKey, type UserSystemRefreshHook } from '@/labs/anzuUser/userSystemProbe'
import { OTHER_SYSTEMS_TAB } from '@/labs/anzuUser/userTabs'

const props = withDefaults(
  defineProps<{
    userId: IntegerId
    /** Which tab carries the owning form, i.e. gets the slot. */
    owner: string
    /**
     * The tabs, in the order they are drawn, plus "other systems" appended by this component.
     *
     * A prop and not something derived from the descriptor array, because the list depends on the
     * route rather than on what the admin owns: admin-inhouse owns four systems and has two tabs,
     * since the system is part of the path.
     */
    ownedTabs: string[]
    /** Every system this admin can reach. The "other systems" tab lists the ones not in a tab. */
    descriptors: AnyUserSystemDescriptor[]
    /**
     * "After a 401, refresh once and try again."
     *
     * The library cannot decide this for itself: the mechanism exists only in the apps, and each
     * one does it differently -- inhouse `refreshSession`, cms and contentHub their own
     * `refresh-token` call. Without it an expired token renders as "no account in this system",
     * which is the one confusion decision 16 forbids. Every panel this shell draws gets it.
     */
    refreshHook?: UserSystemRefreshHook | undefined
    readonly?: boolean
    /**
     * Whether the owning form holds edits that have not been saved.
     *
     * It drives two things. The dot on the owning tab, so the operator can see it from the other
     * tabs -- the Save button itself is visible everywhere, by decision, because a button that
     * disappeared would read as "this is read-only". And the guard below, which is the only thing
     * standing between unsaved work and the button in a panel that leaves the page: switching a tab
     * is not navigation, so nothing else ever asks.
     */
    unsavedChanges?: boolean
    /** Query key for the deep link. */
    tabQueryKey?: string
  }>(),
  {
    refreshHook: undefined,
    readonly: false,
    unsavedChanges: false,
    tabQueryKey: 'tab',
  }
)

const emit = defineEmits<{
  /** After an account was created in another system, so a page can react if it wants to. */
  (e: 'created', descriptor: AnyUserSystemDescriptor): void
}>()

const activeTab = defineModel<string>('activeTab', { required: false, default: '' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const bySystem = computed(() => new Map(props.descriptors.map((item) => [item.system, item])))

const tabs = computed(() => [...props.ownedTabs, OTHER_SYSTEMS_TAB])

const otherDescriptors = computed(() => props.descriptors.filter((item) => !props.ownedTabs.includes(item.system)))

const labelFor = (system: string) => bySystem.value.get(system)?.label ?? system

const isValidTab = (value: unknown): value is string => typeof value === 'string' && tabs.value.includes(value)

onMounted(() => {
  const fromUrl = route.query[props.tabQueryKey]
  // An unknown tab -- a system dropped out of the configuration since the link was sent -- is
  // ignored without a word and the owning tab opens. An error here would help nobody.
  activeTab.value = isValidTab(fromUrl) ? fromUrl : props.owner
})

watch(activeTab, (value) => {
  if (!isValidTab(value)) return
  // `replace`, not `push`: with `push` the back button would walk through the tabs instead of
  // leaving the page.
  void router.replace({ query: { ...route.query, [props.tabQueryKey]: value } })
})

/**
 * Registered here rather than in the page, because this is the component the leaving happens from:
 * an internal "manage in X" is a router link inside a panel, and `onBeforeRouteLeave` has to be
 * bound somewhere inside the route. An external one opens a new tab and leaves this page standing,
 * so it needs no guard at all.
 */
const unsavedSource = computed(() => props.unsavedChanges)
const { hasUnsavedChanges, dirtyLabels, promptOpen, resolvePrompt } = useUnsavedChangesGuard({
  sources: [unsavedSource],
})

const otherSystems = ref<InstanceType<typeof AUserOtherSystemsTable> | null>(null)
const ownedPanels = ref<InstanceType<typeof AUserSystemPanel>[]>([])

/**
 * Creating this person's account in another system.
 *
 * Handled here rather than by the page, because the panel that offers it is here and the whole
 * operation is the library's: read the owning system's record, copy the metadata, post it. The
 * page would only be passing it through.
 */
const writes = useUserCrossSystemWrites()
const { createAnzuUser } = useAnzuUserFactory()
const { showError, showRecordWas } = useAlerts()

// Only when there is one: the panel's own `inject` default is `undefined`, and providing that
// explicitly would say "there is a hook" to anything that merely checks for the key.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
if (!isUndefined(props.refreshHook)) provide(UserSystemRefreshHookKey, props.refreshHook)

const ownerDescriptor = computed(() => bySystem.value.get(props.owner))
/**
 * The owning system's record as the server holds it, not as the form does.
 *
 * Read when the panels are, so the owning tab costs nothing, and read again before each POST: a
 * switch flipped in the form and not saved must not be copied into another system, where in blog
 * and forum it would mean a working public account. That is the whole point of the fix commit this
 * rule comes from.
 */
const sourceUser = ref<AnzuUser | null>(null)
const creatingSystem = ref<string | null>(null)

const loadSource = async () => {
  const descriptor = ownerDescriptor.value
  if (isUndefined(descriptor)) return
  sourceUser.value = await writes.readSourceUser(descriptor, props.userId)
}

/** Copying a person into another system copies whether they are switched on. Roles stay empty. */
const createEnabled = computed(() => sourceUser.value?.enabled === true)

const onCreate = async (descriptor: AnyUserSystemDescriptor, metadata: BaseUser) => {
  const owner = ownerDescriptor.value
  if (isUndefined(owner)) return
  creatingSystem.value = descriptor.system
  try {
    const source = await writes.readSourceUser(owner, props.userId)
    if (isNull(source)) {
      showError(t('common.userSystem.create.sourceUnreadable', { system: labelFor(owner.system) }))
      return
    }
    // The dialog has already promised one of two sentences -- created ready to use, or created
    // switched off -- from the copy read when the panels were. If the server no longer says that,
    // the promise was wrong, and in blog and forum the difference is a working public account. The
    // commonest way to get here is that first read having failed, which leaves `sourceUser` null
    // and the dialog saying "disabled" about an account that is on. Nothing is written until the
    // corrected row has been confirmed again.
    if (source.enabled !== createEnabled.value) {
      sourceUser.value = source
      showError(t('common.userSystem.create.sourceChanged'))
      return
    }
    // From the library factory, never assembled by hand: a body of base fields alone would have the
    // backend fill in `ROLE_USER`, leaving an account with a role nobody granted.
    //
    // The metadata is the dialog's, not the source's: the form was validated against the target's
    // profile and the operator may have filled in what the source leaves empty -- blog fills
    // `person` for nobody, and a system that requires it would get a record its own form refuses
    // to save. The id and `enabled` still come from the fresh read.
    const body = createAnzuUser(descriptor.system)
    body.id = source.id
    body.email = metadata.email
    body.person = cloneDeep(metadata.person)
    body.avatar = cloneDeep(metadata.avatar)
    body.enabled = source.enabled
    const result = await writes.createInSystem(descriptor, body)
    if (result.outcome !== BulkOutcome.Done) {
      // Silence here read as success: the row was re-probed, still said "absent", and nothing
      // explained why. The per-admin pages this replaces reported every write.
      showError(labelFor(descriptor.system) + ': ' + t('common.userSystem.bulk.outcome.' + result.outcome))
      return
    }
    showRecordWas('created')
    emit('created', descriptor)
    otherSystems.value?.refreshSystem(descriptor.system)
    ownedPanels.value.forEach((panel) => panel?.refresh())
  } finally {
    creatingSystem.value = null
  }
}

/**
 * Called by the page after the owning form saved.
 *
 * `VWindowItem` takes only `hasContent` from `useLazy` and hides the panel with `v-show`, so once a
 * panel is mounted it is never unmounted and never re-fetches on its own. Without this the panel
 * would keep showing what it read before the save -- and the create-in-another-system action,
 * which reads from it, would copy that stale snapshot.
 *
 * Deliberately not a refetch on every tab activation: that would turn cheap tab switching into
 * eight calls each time, which is the cost the pseudo-tab was dropped to avoid.
 */
const refresh = () => {
  void loadSource()
  otherSystems.value?.refresh()
  ownedPanels.value.forEach((panel) => panel?.refresh())
}

// Read alongside the panels, on the first activation of a tab that is not the owning one -- so the
// owning tab still costs no foreign call at all.
watch(
  activeTab,
  (value) => {
    // `isValidTab` first: before the mount hook settles it, the model is an empty string, and
    // treating that as "not the owning tab" would fetch on the owning tab too -- the one call this
    // whole lazy arrangement exists to avoid.
    if (!isValidTab(value) || value === props.owner) return
    if (isNull(sourceUser.value)) void loadSource()
  },
  { immediate: true }
)

defineExpose({ refresh })
</script>

<template>
  <div>
    <!--
      No tab navigates. Every one of them redraws the content, and what leaves the page is the
      Manage button inside a panel -- which is an anchor. `VTab` renders `role="tab"` and could not
      carry a navigation semantically.
    -->
    <VTabs
      v-model="activeTab"
      data-cy="user-tabs"
    >
      <VTab
        v-for="tab in tabs"
        :key="tab"
        :value="tab"
        :data-cy="`user-tab-${tab}`"
      >
        {{ tab === OTHER_SYSTEMS_TAB ? t('common.userSystem.tab.otherSystems') : labelFor(tab) }}
        <!-- The owning tab says it holds unsaved work; the Save button itself is always visible. -->
        <VIcon
          v-if="tab === owner && hasUnsavedChanges"
          class="ml-1"
          size="x-small"
          color="warning"
          icon="mdi-circle"
          data-cy="user-tab-unsaved"
        />
      </VTab>
    </VTabs>
    <VWindow
      v-model="activeTab"
      class="mt-4"
    >
      <VWindowItem
        v-for="tab in ownedTabs"
        :key="tab"
        :value="tab"
      >
        <!-- The owning system of the current route: the full form. -->
        <slot v-if="tab === owner" />
        <!--
          Another system this admin owns, but whose route is not open: a probe with a summary and a
          Manage button, exactly like any other system. No tab takes the operator anywhere.
        -->
        <AUserSystemPanel
          v-else-if="!isUndefined(bySystem.get(tab))"
          ref="ownedPanels"
          :descriptor="bySystem.get(tab)!"
          :user-id="userId"
          :readonly="readonly"
          :create-enabled="createEnabled"
          :source="sourceUser"
          :creating="creatingSystem === tab"
          @create="onCreate"
        />
      </VWindowItem>
      <VWindowItem :value="OTHER_SYSTEMS_TAB">
        <!--
          Lazy by construction: `VWindowItem` renders its content on first activation, so opening a
          user costs no foreign calls at all.
        -->
        <AUserOtherSystemsTable
          ref="otherSystems"
          :descriptors="otherDescriptors"
          :user-id="userId"
          :readonly="readonly"
          :create-enabled="createEnabled"
          :source="sourceUser"
          :creating-system="creatingSystem"
          @create="onCreate"
        />
      </VWindowItem>
    </VWindow>
    <AUnsavedConfirmDialog
      v-model="promptOpen"
      :dirty-labels="dirtyLabels"
      @resolve="resolvePrompt"
    />
  </div>
</template>
