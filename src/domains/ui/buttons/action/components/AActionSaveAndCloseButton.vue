<script lang="ts" setup>
import type { RegisteredAclValue } from '@/domains/auth/types/Permission'
import { useAclAllowed } from '@/domains/auth/composables/aclAllowed'
import { eventClickBlur } from '@/shared/utils/event'
import { useI18n } from 'vue-i18n'
import AIconGroup from '@/domains/ui/components/AIconGroup.vue'

const props = withDefaults(
  defineProps<{
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    loading?: boolean
    disabled?: boolean
    // Shown only when the current user passes it; no ACL, no check. An array is evaluated with AND.
    acl?: RegisteredAclValue | RegisteredAclValue[]
    subject?: object
  }>(),
  {
    acl: undefined,
    subject: undefined,
    buttonT: 'common.button.saveAndClose',
    buttonClass: 'ml-2',
    dataCy: 'button-save-close',
    loading: undefined,
    disabled: undefined,
  }
)

const emit = defineEmits<{
  (e: 'saveRecordAndClose'): void
}>()

const aclAllowed = useAclAllowed(
  () => props.acl,
  () => props.subject
)

const onClick = (event: Event) => {
  eventClickBlur(event)
  emit('saveRecordAndClose')
}

const { t } = useI18n()
</script>

<template>
  <template v-if="aclAllowed">
    <VBtn
      :class="buttonClass"
      :aria-label="t(buttonT)"
      :data-cy="dataCy"
      :loading="loading"
      :disabled="disabled"
      color="primary"
      icon=""
      variant="outlined"
      :width="36"
      :height="35"
      @click.stop="onClick"
    >
      <AIconGroup
        main-icon="mdi-content-save"
        secondary-icon="mdi-close"
      />
      <VTooltip
        activator="parent"
        location="bottom"
      >
        {{ t(buttonT) }}
      </VTooltip>
    </VBtn>
  </template>
</template>
