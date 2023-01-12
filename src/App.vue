<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header>
    <div>
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/components/boolean-value">ABooleanValue</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView />
</template>
