<script setup lang="ts">
import { VApp } from 'vuetify/components'
import { inject, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { LanguageCode, modifyLanguageSettings } from '@/composables/languageSettings'
import { AvailableLanguagesSymbol, DefaultLanguageSymbol } from '@/AnzuSystemsCommonAdmin'

const opened = ref([])
const drawer = ref<boolean>(true)

const navIconClick = () => {
  drawer.value = !drawer.value
}

const configAvailableLanguages = inject<LanguageCode[]>(AvailableLanguagesSymbol, [])
const configDefaultLanguage = inject<LanguageCode>(DefaultLanguageSymbol, 'en')
const route = useRoute()
const { initializeLanguage } = modifyLanguageSettings(configAvailableLanguages, configDefaultLanguage)

onMounted(() => {
  initializeLanguage()
})
</script>

<template>
  <VApp>
    <VNavigationDrawer v-model="drawer">
      <VList>
        <VListItem title="Admin common" subtitle="Anzu" class="text-h6"></VListItem>
      </VList>
      <VList v-model:opened="opened" density="compact" nav>
        <VListItem :to="{ name: 'component-row' }" title="ARow"></VListItem>
        <VListItem :to="{ name: 'component-boolean-value' }" title="ABooleanValue"></VListItem>
        <VListItem :to="{ name: 'component-permission' }" title="Permission"></VListItem>
        <VListItem :to="{ name: 'component-datetime' }" title="Datetime"></VListItem>
        <VListItem :to="{ name: 'component-forms' }" title="Forms"></VListItem>
        <VListItem :to="{ name: 'component-datatable' }" title="Datatable"></VListItem>
      </VList>
    </VNavigationDrawer>
    <VAppBar density="compact">
      <div class="d-flex justify-space-between w-100 align-center">
        <div>
          <VAppBarNavIcon @click.stop="navIconClick"></VAppBarNavIcon>
        </div>
      </div>
    </VAppBar>
    <VMain>
      <VContainer class="pa-3" fluid>
        <RouterView :key="route.path" />
      </VContainer>
    </VMain>
  </VApp>
</template>
