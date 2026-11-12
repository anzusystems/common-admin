<script lang="ts" setup>
import { computed, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import AUnsavedConfirmDialog from '@/domains/unsavedGuard/components/AUnsavedConfirmDialog.vue'
import { useUnsavedChangesGuard } from '@/domains/unsavedGuard/composables/useUnsavedChangesGuard'
import type { AnyUserSystemDescriptor } from '@/domains/anzuUser/composables/userSystemDescriptor'
import { UserSystemRefreshHookKey, type UserSystemRefreshHook } from '@/domains/anzuUser/composables/userSystemProbe'
import { OTHER_SYSTEMS_TAB, type UserSystemTab } from '@/domains/anzuUser/utils/userTabs'
import { isUndefined } from '@/shared/utils/common'

const props = withDefaults(
  defineProps<{
    /**
     * One per system this admin manages and the operator may open, in draw order.
     * Each links to that system's user page in the page's mode (detail or edit); the admin decides which are shown.
     */
    tabs: UserSystemTab[]
    /** The "other systems" page. Without it the tab is not drawn. */
    otherSystemsTo?: RouteLocationRaw | undefined
    /** The tab of the page shown: a system of `tabs` or `OTHER_SYSTEMS_TAB`. */
    active: string
    /** For the tab labels. */
    descriptors: AnyUserSystemDescriptor[]
    /**
     * After a 401, refresh once and retry.
     * Each app refreshes differently (inhouse `refreshSession`, cms and contentHub a
     * `refresh-token` call), so the library cannot do it. Without it an expired token shows as "no
     * account in this system", which decision 16 forbids. Every panel in the slot receives it.
     */
    refreshHook?: UserSystemRefreshHook | undefined
    /**
     * Whether the page's form has unsaved edits.
     * It drives the dot on the active tab and the leave guard, which asks before a tab leaves the page.
     */
    unsavedChanges?: boolean
  }>(),
  {
    otherSystemsTo: undefined,
    refreshHook: undefined,
    unsavedChanges: false,
  }
)

const { t } = useI18n()

const bySystem = computed(() => new Map(props.descriptors.map((item) => [item.system, item])))

const labelFor = (system: string) => bySystem.value.get(system)?.label ?? system

/** Registered here, not in the page: every user page has the shell, and a tab is a link out of it. */
const unsavedSource = computed(() => props.unsavedChanges)
const { hasUnsavedChanges, dirtyLabels, promptOpen, resolvePrompt } = useUnsavedChangesGuard({
  sources: [unsavedSource],
})

// Provide only when present. Providing `undefined` explicitly would signal a hook to code that only checks for the key.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
if (!isUndefined(props.refreshHook)) provide(UserSystemRefreshHookKey, props.refreshHook)
</script>

<template>
  <div>
    <!-- `exact` on each tab: an active link selects its tab, and without it a link is also active on nested routes. -->
    <VTabs
      :model-value="active"
      data-cy="user-tabs"
    >
      <VTab
        v-for="tab in tabs"
        :key="tab.system"
        :value="tab.system"
        :to="tab.to"
        exact
        :data-cy="`user-tab-${tab.system}`"
      >
        {{ labelFor(tab.system) }}
        <VIcon
          v-if="tab.system === active && hasUnsavedChanges"
          class="ml-1"
          size="x-small"
          color="warning"
          icon="mdi-circle"
          data-cy="user-tab-unsaved"
        />
      </VTab>
      <VTab
        v-if="!isUndefined(otherSystemsTo)"
        :value="OTHER_SYSTEMS_TAB"
        :to="otherSystemsTo"
        exact
        :data-cy="`user-tab-${OTHER_SYSTEMS_TAB}`"
      >
        {{ t('common.userSystem.tab.otherSystems') }}
      </VTab>
    </VTabs>
    <div class="mt-4">
      <slot />
    </div>
    <AUnsavedConfirmDialog
      v-model="promptOpen"
      :dirty-labels="dirtyLabels"
      @resolve="resolvePrompt"
    />
  </div>
</template>
