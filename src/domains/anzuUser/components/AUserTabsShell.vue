<script lang="ts" setup>
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useAnzuUserFactory } from '@/domains/anzuUser/factory/AnzuUserFactory'
import { cloneDeep, isNull, isUndefined } from '@/shared/utils/common'
import { BulkOutcome } from '@/domains/anzuUser/store/userCrossSystemStore'
import { useUserCrossSystemWrites } from '@/domains/anzuUser/composables/userCrossSystemWrites'
import AUnsavedConfirmDialog from '@/domains/unsavedGuard/components/AUnsavedConfirmDialog.vue'
import { useUnsavedChangesGuard } from '@/domains/unsavedGuard/composables/useUnsavedChangesGuard'
import AUserOtherSystemsTable from '@/domains/anzuUser/components/AUserOtherSystemsTable.vue'
import AUserSystemPanel from '@/domains/anzuUser/components/AUserSystemPanel.vue'
import { type AnyUserSystemDescriptor, descriptorMayWrite } from '@/domains/anzuUser/composables/userSystemDescriptor'
import type { AnzuUser, BaseUser } from '@/shared/types/AnzuUser'
import type { IntegerId } from '@/shared/types/common'
import { UserSystemRefreshHookKey, type UserSystemRefreshHook } from '@/domains/anzuUser/composables/userSystemProbe'
import { OTHER_SYSTEMS_TAB } from '@/domains/anzuUser/utils/userTabs'

const props = withDefaults(
  defineProps<{
    userId: IntegerId
    /**
     * Which tab carries the owning form, i.e. gets the slot.
     */
    owner: string
    /**
     * The tabs in draw order. This component appends "other systems".
     * A prop, not derived from descriptors, because it depends on the route. admin-inhouse
     * owns four systems but has two tabs, since the system is part of the path.
     */
    ownedTabs: string[]
    /**
     * Every system this admin can reach. The "other systems" tab lists the ones not in a tab.
     */
    descriptors: AnyUserSystemDescriptor[]
    /**
     * After a 401, refresh once and retry.
     * Each app refreshes differently (inhouse `refreshSession`, cms and contentHub a
     * `refresh-token` call), so the library cannot do it. Without it an expired token shows as "no
     * account in this system", which decision 16 forbids. Every panel in this shell receives it.
     */
    refreshHook?: UserSystemRefreshHook | undefined
    readonly?: boolean
    /**
     * Whether the owning form has unsaved edits.
     * It drives the dot on the owning tab. The Save button stays visible
     * everywhere, because a hidden button would read as read-only.
     * It also drives the leave guard. Switching tabs is not navigation,
     * so nothing else asks before a panel button leaves the page.
     */
    unsavedChanges?: boolean
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
  /**
   * After an account was created in another system, so a page can react if it wants to.
   */
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
  // An unknown tab, for example a system removed from the configuration
  // since the link was sent, is ignored silently and the owning tab opens.
  activeTab.value = isValidTab(fromUrl) ? fromUrl : props.owner
})

watch(activeTab, (value) => {
  if (!isValidTab(value)) return
  // `replace`, not `push`: with `push` the back button would walk through the tabs instead of
  // leaving the page.
  void router.replace({ query: { ...route.query, [props.tabQueryKey]: value } })
})

/**
 * Registered here, not in the page, because an internal "manage in X" link inside a
 * panel leaves from here and `onBeforeRouteLeave` must be bound inside the route.
 * An external link opens a new tab and needs no guard.
 */
const unsavedSource = computed(() => props.unsavedChanges)
const { hasUnsavedChanges, dirtyLabels, promptOpen, resolvePrompt } = useUnsavedChangesGuard({
  sources: [unsavedSource],
})

const otherSystems = ref<InstanceType<typeof AUserOtherSystemsTable> | null>(null)
const ownedPanels = ref<InstanceType<typeof AUserSystemPanel>[]>([])

/**
 * Creating this person's account in another system.
 * Handled here because the panel offering it lives here and the
 * operation belongs to the library. The page would only pass it through.
 */
const writes = useUserCrossSystemWrites()
const { createAnzuUser } = useAnzuUserFactory()
const { showError, showRecordWas } = useAlerts()

// Provide only when present. Providing `undefined` explicitly would signal a hook to code that only checks for the key.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
if (!isUndefined(props.refreshHook)) provide(UserSystemRefreshHookKey, props.refreshHook)

const ownerDescriptor = computed(() => bySystem.value.get(props.owner))
/**
 * The owning system's record as the server holds it, not as the form does.
 * Read together with the panels, so the owning tab costs nothing, and read again before each POST. An unsaved
 * switch in the form must not be copied, because in blog and forum it would mean a working public account.
 */
const sourceUser = ref<AnzuUser | null>(null)
const creatingSystem = ref<string | null>(null)

const loadSource = async () => {
  const descriptor = ownerDescriptor.value
  if (isUndefined(descriptor)) return
  sourceUser.value = await writes.readSourceUser(descriptor, props.userId)
}

/**
 * Copying a person into another system copies whether they are switched on. Roles stay empty.
 */
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
    // The dialog already promised "created ready to use" or "created switched off" from the earlier read. If the
    // server now disagrees, the promise was wrong, and in blog and forum that means a working public account.
    // Usually the first read failed, leaving `sourceUser` null and the dialog saying "disabled"
    // for an enabled account. Nothing is written until the corrected row is confirmed again.
    if (source.enabled !== createEnabled.value) {
      sourceUser.value = source
      showError(t('common.userSystem.create.sourceChanged'))
      return
    }
    // The create right may have been lost while the source was read. Nothing is offered then, so nothing is reported.
    if (!descriptorMayWrite(descriptor, 'create')) return
    // Built by the library factory, never by hand. A body of base fields
    // alone makes the backend add `ROLE_USER`, a role nobody granted.
    // Metadata comes from the dialog, validated against the target's profile. The source may leave fields empty
    // (blog never fills `person`) that the target requires. The id and `enabled` come from the fresh read.
    const body = createAnzuUser(descriptor.system)
    body.id = source.id
    body.email = metadata.email
    body.person = cloneDeep(metadata.person)
    body.avatar = cloneDeep(metadata.avatar)
    body.enabled = source.enabled
    const result = await writes.createInSystem(descriptor, body)
    if (result.outcome !== BulkOutcome.Done) {
      // Without this message the failure looked like success: the
      // re-probed row still said "absent" with no explanation.
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
 * `VWindowItem` hides panels with `v-show`, so a mounted panel never re-fetches by itself. Without
 * this it shows pre-save data, and create-in-another-system would copy that stale snapshot.
 * Not a refetch on every tab activation: that would cost eight calls per tab switch.
 */
const refresh = () => {
  void loadSource()
  otherSystems.value?.refresh()
  ownedPanels.value.forEach((panel) => panel?.refresh())
}

// Read on the first activation of a non-owning tab, so the owning tab makes no foreign call.
watch(
  activeTab,
  (value) => {
    // `isValidTab` first: before mount settles, the model is an empty string.
    // Treating it as a non-owning tab would fetch on the owning tab too.
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
      No tab navigates. Tabs only switch content, and leaving the page is done by the Manage
      anchor inside a panel. `VTab` renders `role="tab"` and cannot carry navigation semantically.
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
          Another system this admin owns whose route is not open: a probe
          with a summary and a Manage button, like any other system.
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
        <!-- `VWindowItem` renders content on first activation, so opening a user makes no foreign calls. -->
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
