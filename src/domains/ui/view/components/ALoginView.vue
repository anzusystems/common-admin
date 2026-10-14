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
  }
)

const { t } = useI18n()

// The sign-in page takes the place of the admin's own `/login` in the browser history: left there, Back from the
// admin after the sign-in showed the sign-in page to a user who is signed in. A press the browser takes for a tab, a
// window or a download of its own (with Ctrl, Cmd, Shift or Alt, the middle button) goes on as a link does.
// Without an address the button is no link, and a press does nothing, as before.
const onLoginClick = (event: MouseEvent) => {
  const link = event.currentTarget
  if (!(link instanceof HTMLAnchorElement) || !link.href) return
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  window.location.replace(link.href)
}
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
          @click="onLoginClick"
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
