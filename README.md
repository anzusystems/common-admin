# Common admin components for anzusystems vue projects 

## Install dependencies

```shell
yarn install
```

## Build library

Build lib files.

```shell
yarn build
```

## Publish library

Publish to npmjs is automated, it will be run upon a new release in GitHub.

## Install library in project

```shell
yarn add @anzusystems/common-admin
```

## Use in project

```vue
<script lang="ts" setup>
import { ABooleanValue } from '@anzusystems/common-admin'
</script>

<template>
  <ABooleanValue :value="true" chip></ABooleanValue>
</template>
```
