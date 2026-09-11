<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    title?: string | undefined
    logoUrl?: string | undefined
    loginUrl?: undefined | (() => string)
    dataCy?: string
  }>(),
  {
    title: undefined,
    logoUrl: undefined,
    loginUrl: undefined,
    dataCy: 'button-login',
  },
)

const { t } = useI18n()
</script>

<template>
  <div class="d-flex justify-center align-center fill-height">
    <div class="d-flex justify-center align-center flex-column">
      <slot name="title">
        <img
          :src="logoUrl"
          class="logo pb-2"
          alt=""
        />
        <h1
          v-if="title"
          class="text-headline-large my-3"
        >
          {{ title }}
        </h1>
      </slot>
      <h4 class="mb-3 text-body-large">
        <span>{{ t('common.system.login.text') }}</span>
      </h4>
      <div class="py-5">
        <VBtn
          v-if="loginUrl"
          :data-cy="dataCy"
          :href="loginUrl()"
          color="primary"
          size="large"
        >
          {{ t('common.system.login.text') }}
        </VBtn>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.logo {
  display: block;
  max-width: 120px;
  height: auto;
}
</style>
