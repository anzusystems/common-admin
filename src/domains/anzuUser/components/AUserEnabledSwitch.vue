<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import ABooleanValue from '@/domains/ui/components/ABooleanValue.vue'
import ARow from '@/domains/ui/components/ARow.vue'

withDefaults(
  defineProps<{
    readonly?: boolean
    /**
     * The system's `enabledNote`. A descriptor string rather than a slot, so every admin shows the
     * same wording as the bulk dialog and admin-blog, where it matters most, cannot forget it.
     * The slot below remains for content longer than a line.
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
      Outside `AUserMetadataForm` on purpose. That form mirrors `BaseUserDto`, which has no
      `enabled`, and the cross-system metadata repair uses it and must not write this field.
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
