<script setup>
import ARowDemo from './ARowDemo.vue'
</script>

# ARow

- mostly used to print data in detail view
- it's shorthand to this code:

```vue
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
<DocsExample>
  <ARowDemo />
</DocsExample>

<<< @/api/components/a-row/ARowDemo.vue

## Types
#### Props
<<< @/../src/components/ARow.vue#docs-props{ts}

#### Slots
- default
