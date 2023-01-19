<script setup lang="ts">
import { VApp } from 'vuetify/components'
import { ref } from 'vue'

const opened = ref([])

const drawer = ref<boolean>(true)

const navIconClick = () => {
  drawer.value = !drawer.value
}

</script>

<template>
  <VApp>
    <VNavigationDrawer v-model="drawer">
      <VList>
        <VListItem title="Admin common" subtitle="Anzu" class="text-h6"></VListItem>
      </VList>
      <VList v-model:opened="opened" density="compact" nav>
        <VListItem
          :to="{ name: 'component-row' }"
          title="ARow"
        ></VListItem>
        <VListItem
          :to="{ name: 'component-boolean-value' }"
          title="ABooleanValue"
        ></VListItem>
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
        <RouterView/>
      </VContainer>
    </VMain>
  </VApp>
</template>
