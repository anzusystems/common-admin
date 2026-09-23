<script setup>
import ACardDemo from './ACardDemo.vue'
</script>

# ACard

- it's just a wrapper component for vuetify's `VCard` with `variant="flat"`, other attributes are passed to `VCard`
- when `loading` prop is active, it shows `VCard` loading bar and a layer to prevent to click on any element inside
- `title` is passed to `VCard` `title`
- `blockInput` together with `loading` also sets `inert` on the card, so focus and keyboard input inside are blocked too

## Examples
<DocsExample>
  <ACardDemo />
</DocsExample>

<<< @/api/components/a-card/ACardDemo.vue

## Types
#### Props
```ts
loading?: boolean
title?: string
blockInput?: boolean // default: false
```
Other props: check [vuetify docs](https://vuetifyjs.com/en/api/v-card/#props)

#### Slots
- default
