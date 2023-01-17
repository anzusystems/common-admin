# Vue 3 + Vuetify 3 + TypeScript + Vite lib

## Build library

Build dist files.

```shell
yarn build
```

## Publish library

Publish to npm.

```shell
npm publish
```

## Install library in project

```shell
yarn add @sakulb/common-lib
```

## Use in project

```vue
<script lang="ts" setup>
import { AButton, AAbout, AChip } from '@sakulb/common-lib'
</script>

<template>
  <AButton></AButton>
  <hr>
  <AAbout text="bla"></AAbout>
  <hr>
  <AChip></AChip>
</template>
```
