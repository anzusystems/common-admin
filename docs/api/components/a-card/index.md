<script setup>
import Demo1 from './ACardDemo.vue'
</script>

# ACard

- it's just a wrapper component for vuetify's `VCard`, so you can use all props as for `VCard`
- there is only one difference: it uses `ACardLoader` component to create layer to prevent to click on any element inside, when `loading` prop is active

## Examples
<ClientOnly>
  <ACardDemo />
</ClientOnly>

<<< @/api/components/a-card/ACardDemo.vue

## Types
#### Props
Check [vuetify docs](https://vuetifyjs.com/en/api/v-card/#props)

#### Slots
- default
