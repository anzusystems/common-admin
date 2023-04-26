<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import type { AnzuUserMinimal } from '@/types/AnzuUser'
import AAnzuUserAvatar from '@/components/AAnzuUserAvatar.vue'

withDefaults(
  defineProps<{
    currentUser: AnzuUserMinimal | undefined | null
    settingsRouteName: string
    logoutRouteName: string
    dataCy?: string
  }>(),
  {
    dataCy: 'navbar-user',
  }
)

const { t } = useI18n()

const logoutDialog = ref(false)
</script>

<template>
  <VBtn
    variant="text"
    icon
    size="small"
    :data-cy="dataCy"
  >
    <AAnzuUserAvatar
      :size="32"
      :user="currentUser"
    />
    <VTooltip
      activator="parent"
      location="top"
    >
      {{ t('common.system.currentUser.button') }}
    </VTooltip>
    <VMenu
      v-if="currentUser"
      activator="parent"
    >
      <VCard>
        <VList class="pb-0">
          <VListItem
            class="pb-6"
            lines="two"
          >
            <template #prepend>
              <AAnzuUserAvatar
                :user="currentUser"
                :size="40"
              />
            </template>
            <VListItemTitle>{{ currentUser.person.fullName }}</VListItemTitle>
            <VListItemSubtitle>
              {{ currentUser.email }}<br>
              {{ currentUser.id }}
            </VListItemSubtitle>
          </VListItem>
          <VDivider />
          <VListItem
            :active="false"
            prepend-icon="mdi-cog"
            :to="{ name: settingsRouteName }"
            data-cy="navbar-user-settings"
          >
            {{ t('common.system.currentUser.settings') }}
          </VListItem>
          <VListItem
            prepend-icon="mdi-logout"
            data-cy="navbar-user-logout"
            @click.stop="logoutDialog = true"
          >
            {{ t('common.system.currentUser.logout') }}
            <VDialog
              v-model="logoutDialog"
              width="auto"
            >
              <VCard v-if="logoutDialog">
                <VToolbar
                  density="compact"
                  color="transparent"
                >
                  <VToolbarTitle class="flex-fill">
                    {{ t('common.system.currentUser.logout') }}
                  </VToolbarTitle>
                  <VSpacer />
                  <VBtn
                    class="ml-2"
                    icon="mdi-close"
                    size="small"
                    variant="text"
                    data-cy="button-close"
                    @click.stop="logoutDialog = false"
                  />
                </VToolbar>
                <VCardText>{{ t('common.system.currentUser.logoutText') }}</VCardText>
                <VCardActions>
                  <VSpacer />
                  <VBtn
                    color="secondary"
                    variant="text"
                    data-cy="button-cancel"
                    @click.stop="logoutDialog = false"
                  >
                    {{ t('common.button.cancel') }}
                  </VBtn>
                  <VBtn
                    color="primary"
                    data-cy="button-create"
                    :to="{ name: logoutRouteName }"
                  >
                    {{ t('common.system.currentUser.logoutConfirm') }}
                  </VBtn>
                </VCardActions>
              </VCard>
            </VDialog>
          </VListItem>
        </VList>
      </VCard>
    </VMenu>
  </VBtn>
</template>
