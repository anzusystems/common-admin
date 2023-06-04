<script setup>
import Demo1 from './Demo1.vue'
</script>

# ARow

- mostly used to print data in detail view
- it's shorthand to this code:

```html
<VRow>
  <VCol>
    <h4 class="text-subtitle-2">
      {{ title }}
    </h4>
    <slot>
      <span class="text-high-emphasis">{{ value }}</span>
    </slot>
  </VCol>
</VRow>
```

## Examples
<ClientOnly>
  <Demo1 />
</ClientOnly>

<<< @/api/a-row/Demo1.vue

## Types
#### Props
<<< @/../src/components/ARow.vue#docs-props{ts}

#### Slots
- default
