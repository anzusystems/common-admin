<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const reloadAdmin = () => {
  window.location.reload()
}
</script>

<template>
  <span v-once class="system-bar-new-version">
    {{ t('common.system.newVersionText') }}
    <span class="text-decoration-underline cursor-pointer" @click.stop="reloadAdmin">
      {{ t('common.system.newVersionReload') }}
    </span>
  </span>
</template>
