<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserSystemManageTarget } from '@/domains/anzuUser/composables/userSystemDescriptor'

const props = withDefaults(
  defineProps<{
    target: UserSystemManageTarget
    systemLabel: string
    /**
     * "Edit" instead of "Manage in X" -- used where the operator is already in that admin.
     */
    internalLabel?: string | undefined
  }>(),
  {
    internalLabel: undefined,
  }
)

const { t } = useI18n()

const isExternal = computed(() => props.target.kind === 'external')

/**
 * A missing url means the template is configured but absent. Show the reason instead of a silently disabled button.
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
        An anchor, not a click handler, so middle-click, open in new tab and screen reader announcements work.
        This is also why the tab bar never navigates: `VTab` renders `role="tab"` and cannot carry a link.
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
