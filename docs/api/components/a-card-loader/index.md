<script setup>
import ACardLoaderDemo from './ACardLoaderDemo.vue'
</script>

# ACardLoader

- component that creates layer to prevent to click on any element inside, when `loading` prop is active
- it's implemented in [ACard], so nothing additional needed to this component, just set `loading` prop
- you can also use it in combination with `VCard` if needed

## Examples
<DocsExample>
  <ACardLoaderDemo />
</DocsExample>

<<< @/api/components/a-card-loader/ACardLoaderDemo.vue

## Types
#### Props
<<< @/../src/components/ACardLoader.vue#docs-props{ts}
