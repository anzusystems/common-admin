<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserSystemManageTarget } from '@/labs/anzuUser/userSystemDescriptor'

const props = withDefaults(
  defineProps<{
    target: UserSystemManageTarget
    /** The system's name as the app translates it. */
    systemLabel: string
    /** "Edit" instead of "Manage in X" -- used where the operator is already in that admin. */
    internalLabel?: string | undefined
  }>(),
  {
    internalLabel: undefined,
  }
)

const { t } = useI18n()

const isExternal = computed(() => props.target.kind === 'external')

/**
 * A missing url is a configured-but-absent template, and it says so rather than sitting there dead.
 * The prototype this replaces did `:disabled="!userEditUrl"` and gave no reason -- while the
 * variable it depended on was in fact misconfigured in every environment.
 */
const missingUrl = computed(() => props.target.kind === 'external' && props.target.href === null)

const href = computed(() => (props.target.kind === 'external' ? (props.target.href ?? undefined) : undefined))
const to = computed(() => (props.target.kind === 'internal' ? props.target.to : undefined))

const label = computed(() =>
  isExternal.value
    ? t('common.userSystem.button.manageIn', { system: props.systemLabel })
    : (props.internalLabel ?? t('common.userSystem.button.edit'))
)
</script>

<template>
  <VTooltip
    :disabled="!missingUrl"
    location="top"
  >
    <template #activator="{ props: tooltipProps }">
      <!--
        An anchor, not a click handler. This is what leaves the page, so middle-click, open in a new
        tab and the screen reader's announcement all have to work -- which is also why the tab bar
        never navigates: `VTab` renders `role="tab"` and could not carry this.
      -->
      <span v-bind="tooltipProps">
        <VBtn
          :to="to"
          :href="href"
          :target="isExternal ? '_blank' : undefined"
          :rel="isExternal ? 'noopener' : undefined"
          :append-icon="isExternal ? 'mdi-open-in-new' : undefined"
          :variant="isExternal ? 'outlined' : 'flat'"
          :color="isExternal ? undefined : 'primary'"
          :disabled="missingUrl"
          size="small"
          data-cy="user-system-manage"
        >
          {{ label }}
        </VBtn>
      </span>
    </template>
    {{ t('common.userSystem.manageMissingUrl') }}
  </VTooltip>
</template>
