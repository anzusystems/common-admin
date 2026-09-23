<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import ABooleanValue from '@/components/ABooleanValue.vue'
import ARow from '@/components/ARow.vue'

withDefaults(
  defineProps<{
    readonly?: boolean
    /**
     * The system's `enabledNote`. A static string from the descriptor rather than a slot: a slot
     * would have to be filled by every admin separately, could drift from the wording in the bulk
     * dialog, and -- worst -- could be forgotten in admin-blog, which is the one place the sentence
     * matters most. The slot below stays as an escape hatch for more than a line of text.
     */
    note?: string | undefined
  }>(),
  {
    readonly: false,
    note: undefined,
  }
)

const modelValue = defineModel<boolean>({ required: true })

const { t } = useI18n()
</script>

<template>
  <div>
    <!--
      Outside `AUserMetadataForm` on purpose: that one mirrors `BaseUserDto`, which has no
      `enabled`, and is also used by the cross-system metadata repair -- which must not write this
      field and would otherwise have to hide it.
    -->
    <ARow
      v-if="readonly"
      :title="t('common.anzuUser.model.enabled')"
    >
      <ABooleanValue
        :value="modelValue"
        chip
      />
    </ARow>
    <VSwitch
      v-else
      v-model="modelValue"
      :label="t('common.anzuUser.model.enabled')"
      color="success"
      density="compact"
      hide-details
      data-cy="user-enabled"
    />
    <div class="text-body-small text-medium-emphasis">
      <slot name="note">
        <template v-if="note">{{ note }}</template>
      </slot>
    </div>
  </div>
</template>
