<script setup lang="ts">
import { VApp } from 'vuetify/components'
import { inject, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { type LanguageCode, modifyLanguageSettings } from '@/composables/languageSettings'
import { AvailableLanguagesSymbol, DefaultLanguageSymbol } from '@/AnzuSystemsCommonAdmin'
import ALanguageSelect from '@/components/ALanguageSelect.vue'

const opened = ref([])
const drawer = ref<boolean>(true)

const navIconClick = () => {
  drawer.value = !drawer.value
}

const configAvailableLanguages = inject<LanguageCode[]>(AvailableLanguagesSymbol, [])
const configDefaultLanguage = inject<LanguageCode>(DefaultLanguageSymbol, 'en')
const route = useRoute()
const { initializeLanguage, addMessages, currentLanguageCode } = modifyLanguageSettings(
  configAvailableLanguages,
  configDefaultLanguage
)

const loadLanguageMessages = async (code: LanguageCode | 'default') => {
  if (code === 'default' || code === 'xx') return
  try {
    const messages = await import(`./locales/${code}.ts`)
    addMessages(code, messages.default)
  } catch (e) {
    console.error('Unable to load language translation messages.')
  }
}

const afterLanguageChange = async (language: LanguageCode) => {
  await loadLanguageMessages(language)
}

onMounted(async () => {
  initializeLanguage()
  await loadLanguageMessages(currentLanguageCode.value)
})
</script>

<template>
  <VApp>
    <VNavigationDrawer v-model="drawer">
      <VList>
        <VListItem
          title="Admin common"
          subtitle="Anzu"
          class="text-h6"
        />
      </VList>
      <VList
        v-model:opened="opened"
        density="compact"
        nav
      >
        <VListItem
          :to="{ name: 'component-row' }"
          title="ARow"
        />
        <VListItem
          :to="{ name: 'component-boolean-value' }"
          title="ABooleanValue"
        />
        <VListItem
          :to="{ name: 'component-permission' }"
          title="Permission"
        />
        <VListItem
          :to="{ name: 'component-datetime' }"
          title="Datetime"
        />
        <VListItem
          :to="{ name: 'component-forms' }"
          title="Forms"
        />

        <VListItem
          :to="{ name: 'component-buttons' }"
          title="Buttons"
        />
      </VList>
    </VNavigationDrawer>
    <VAppBar density="compact">
      <div class="d-flex justify-space-between w-100 align-center">
        <div>
          <VAppBarNavIcon @click.stop="navIconClick" />
        </div>
        <ALanguageSelect @after-change="afterLanguageChange" />
      </div>
    </VAppBar>
    <VMain>
      <VContainer
        class="pa-3"
        fluid
      >
        <RouterView :key="route.path" />
      </VContainer>
    </VMain>
  </VApp>
</template>
