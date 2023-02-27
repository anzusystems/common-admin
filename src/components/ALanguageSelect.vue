<script lang="ts" setup>
import type { Language, LanguageCode } from '@/composables/languageSettings'
import { ALL_LANGUAGES, modifyLanguageSettings, useLanguageSettings } from '@/composables/languageSettings'
import { computed, inject } from 'vue'
import { isUndefined } from '@/utils/common'
import FlagCountry from '@/components/flags/FlagCountry.vue'
import {
  AvailableLanguagesSymbol,
  CurrentUserSymbol,
  CurrentUserType,
  DefaultLanguageSymbol,
} from '@/AnzuSystemsCommonAdmin'
import { ROLE_SUPER_ADMIN } from '@/composables/system/ability'

const emit = defineEmits<{
  (e: 'afterChange', code: LanguageCode): void
}>()

const currentUser = inject(CurrentUserSymbol) as CurrentUserType
const configAvailableLanguages = inject(AvailableLanguagesSymbol) as LanguageCode[]
const configDefaultLanguage = inject(DefaultLanguageSymbol) as LanguageCode
// @ts-ignore
const { setLanguage } = modifyLanguageSettings(configAvailableLanguages, configDefaultLanguage)
const { currentLanguageCode } = useLanguageSettings()

const onLanguageChange = (code: LanguageCode) => {
  const result = setLanguage(code)
  if (result) emit('afterChange', code)
}

const currentLocale = computed(() => {
  const found = ALL_LANGUAGES.find((item) => item.code === currentLanguageCode.value)
  if (isUndefined(found)) {
    return ALL_LANGUAGES[0]
  }
  return found as Language
})

const availableLocales = computed(() => {
  return ALL_LANGUAGES.filter(
    (item) =>
      configAvailableLanguages.includes(item.code) &&
      (!item.adminOnly || currentUser.value?.roles.includes(ROLE_SUPER_ADMIN))
  )
})
</script>

<template>
  <VMenu>
    <template #activator="{ props }">
      <VBtn class="pl-1" rounded="pill" v-bind="props" variant="text" data-cy="settings-language">
        <VAvatar class="mr-1" size="30">
          <FlagCountry :code="currentLocale?.code" />
        </VAvatar>
        {{ currentLocale.title }}
      </VBtn>
    </template>
    <VCard>
      <VList dense>
        <VListItem v-for="locale in availableLocales" :key="locale.code" @click.stop="onLanguageChange(locale.code)">
          <VListItemTitle>
            <VAvatar class="mr-1" size="30">
              <FlagCountry :code="locale.code" />
            </VAvatar>
            {{ locale.title }}
          </VListItemTitle>
        </VListItem>
      </VList>
    </VCard>
  </VMenu>
</template>

<style lang="scss" scoped>
.flag {
  position: relative;
  width: 30px;
  height: 30px;

  :deep(svg) {
    width: 90px;
    height: 60px;
    position: absolute;
    top: -15px;
    left: -27px;
    transform: scale(0.7);
  }
}
</style>
