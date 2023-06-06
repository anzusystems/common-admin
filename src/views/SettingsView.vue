<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { inject } from 'vue'
import ACard from '@/components/ACard.vue'
import ALanguageSelect from '@/components/ALanguageSelect.vue'
import AThemeSelect from '@/components/AThemeSelect.vue'
import type { LanguageCode } from '@/composables/languageSettings'
import { AvailableLanguagesSymbol, DefaultLanguageSymbol } from '@/AnzuSystemsCommonAdmin'
import { modifyLanguageSettings } from '@/composables/languageSettings'

const { t } = useI18n()
const configAvailableLanguages = inject<LanguageCode[]>(AvailableLanguagesSymbol, [])
const configDefaultLanguage = inject<LanguageCode>(DefaultLanguageSymbol, 'sk')
const { addMessages } = modifyLanguageSettings(configAvailableLanguages, configDefaultLanguage)

const loadLanguageMessages = async (code: LanguageCode | 'default') => {
  if (code === 'default' || code === 'xx') return
  try {
    const messages = await import(`../locales/${code}.ts`)
    addMessages(code, messages.default)
  } catch (e) {
    console.error('Unable to load language translation messages.')
  }
}

const afterLanguageChange = async (language: LanguageCode) => {
  await loadLanguageMessages(language)
}
</script>

<template>
  <!--  <ActionbarWrapper />-->

  <ACard>
    <VCardText>
      <VRow>
        <VCol cols="6">
          <VRow
            align="center"
            class="pb-2"
          >
            <VCol cols="3">
              {{ t('system.settings.locale') }}
            </VCol>
            <VCol>
              <ALanguageSelect @after-change="afterLanguageChange" />
            </VCol>
          </VRow>
          <VRow
            align="center"
            class="pb-2"
          >
            <VCol cols="3">
              {{ t('system.settings.theme') }}
            </VCol>
            <VCol>
              <AThemeSelect />
            </VCol>
          </VRow>
        </VCol>
      </VRow>
    </VCardText>
  </ACard>
</template>
