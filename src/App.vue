<script setup lang="ts">
import { ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useTheme } from '@/composables/themeSettings'
import SidebarMain from '@/playground/system/SidebarMain.vue'
import SidebarRail from '@/playground/system/SidebarRail.vue'
import SidebarAppendMain from '@/playground/system/SidebarAppendMain.vue'
import SidebarAppendRail from '@/playground/system/SidebarAppendRail.vue'
import AAlerts from '@/components/AAlerts.vue'
import ActionbarTeleportTarget from '@/playground/system/ActionbarTeleportTarget.vue'
import { useRoute } from 'vue-router'
import logoFull from '@/assets/logo-ca-full.svg'
import logoNoText from '@/assets/logo-ca-no-text.svg'

const route = useRoute()

const { mobile } = useDisplay()

const drawer = ref(true)
const rail = ref(false)

const navIconClick = () => {
  if (mobile.value) {
    rail.value = false
    drawer.value = !drawer.value
    return
  }
  drawer.value = true
  rail.value = !rail.value
}

const { theme } = useTheme()
</script>

<template>
  <AAlerts />
  <VApp :theme="theme">
    <VNavigationDrawer
      v-model="drawer"
      :rail="rail"
    >
      <SidebarMain v-show="!rail" />
      <SidebarRail
        v-show="rail"
        v-if="!mobile"
      />
      <template #append>
        <VDivider />
        <SidebarAppendMain :class="{ 'd-flex': !rail, 'd-none': rail }" />
        <SidebarAppendRail
          v-if="!mobile"
          :class="{ 'd-flex': rail, 'd-none': !rail }"
        />
      </template>
    </VNavigationDrawer>
    <VAppBar
      density="compact"
      elevation="0"
      class="system-border-b"
      :order="-1"
    >
      <div class="d-flex pr-2 w-100 justify-space-between full-width align-center">
        <div class="d-flex align-center">
          <VAppBarNavIcon
            data-cy="navbar-collapse"
            size="small"
            class="mx-1"
            @click.stop="navIconClick"
          />
        </div>
        <div class="main-logo mr-sm-2">
          <RouterLink
            :to="{ name: 'home' }"
            class="text-decoration-none"
          >
            <img
              width="104"
              height="42"
              :src="logoFull"
              alt="Admin"
              class="hidden-xs"
            >
            <img
              width="42"
              height="42"
              :src="logoNoText"
              alt="Inhouse"
              class="hidden-sm-and-up"
            >
          </RouterLink>
        </div>
        <KeepAlive>
          <ActionbarTeleportTarget />
        </KeepAlive>
      </div>
    </VAppBar>
    <VMain>
      <VContainer
        class="pa-2"
        fluid
      >
        <RouterView :key="route.path" />
      </VContainer>
    </VMain>
  </VApp>
</template>

<style lang="scss">
.main-logo img {
  height: 38px;
  display: block;
  width: auto;
}
</style>

