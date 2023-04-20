<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { eventClickBlur } from '@/utils/event'

// only example, do not use for now

withDefaults(
  defineProps<{
    buttonT?: string
    buttonClass?: string
    icon?: boolean
    dataCy?: string
    loading?: boolean
    disabled?: boolean
    disableClose?: boolean
  }>(),
  {
    buttonT: 'common.button.save',
    buttonClass: 'ml-2',
    icon: false,
    dataCy: 'button-save',
    loading: undefined,
    disabled: undefined,
    disableClose: false,
  }
)
const emit = defineEmits<{
  (e: 'saveRecord'): void
  (e: 'saveRecordAndClose'): void
}>()

const onClick = (event: Event) => {
  eventClickBlur(event)
  emit('saveRecord')
}

const onClickClose = (event: Event) => {
  eventClickBlur(event)
  emit('saveRecordAndClose')
}

const { t } = useI18n()
</script>

<template>
  <VBtn
    v-if="icon"
    :class="buttonClass"
    :data-cy="dataCy"
    :elevation="0"
    icon
    size="small"
    variant="outlined"
    :loading="loading"
    :disabled="disabled"
    @click.stop="onClick"
  >
    <VIcon icon="mdi-content-save" />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t(buttonT) }}
    </VTooltip>
  </VBtn>
  <VBtn
    v-else-if="disableClose"
    :class="buttonClass"
    :data-cy="dataCy"
    color="primary"
    rounded="pill"
    :loading="loading"
    :disabled="disabled"
    @click.stop="onClick"
  >
    {{ t(buttonT) }}
  </VBtn>
  <div
    v-else
    class="a-button-split d-inline-flex"
    :class="buttonClass"
  >
    <VBtn
      class="a-button-split__main"
      :data-cy="dataCy"
      :loading="loading"
      :disabled="disabled"
      rounded="pill"
      color="primary"
      @click.stop="onClick"
    >
      {{ t(buttonT) }}
    </VBtn>
    <div class="a-button-split__divider d-inline-flex" />
    <VBtn
      :disabled="disabled || loading"
      :data-cy="dataCy"
      color="primary"
      rounded="pill"
      class="a-button-split__more"
    >
      <VIcon icon="mdi-chevron-down" />
      <VMenu
        activator="parent"
        location="bottom end"
      >
        <VList class="pa-0">
          <v-list-item @click.stop="onClickClose">
            <v-list-item-title>{{ t('common.button.saveAndClose') }}</v-list-item-title>
          </v-list-item>
        </VList>
      </VMenu>
    </VBtn>
  </div>
</template>

<style lang="scss">
.a-button-split {
  .a-button-split__main.rounded-pill {
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    padding-right: 10px !important;
  }
  .a-button-split__more.rounded-pill {
    border-top-left-radius: 0 !important;
    border-bottom-left-radius: 0 !important;
    padding: 0 4px 0 0 !important;
    min-width: 32px !important;
  }
  .a-button-split__divider {
    display: inline-block;
    width: 1px;
  }
}
</style>
