<script lang="ts" setup>
import { isNull } from '@/utils/common'

withDefaults(
  defineProps<{
    mainIcon: string
    secondaryIcon?: null | string
    secondaryText?: null | string
    size?: string
  }>(),
  {
    secondaryIcon: null,
    secondaryText: null,
    size: 'default',
  }
)
</script>

<template>
  <div
    v-if="!isNull(secondaryIcon)"
    class="anzu-icon-group"
  >
    <VIcon
      :size="size"
      class="anzu-icon-group__main-icon"
      :icon="mainIcon"
    />
    <VIcon
      :size="size"
      class="anzu-icon-group__secondary-icon"
      :icon="secondaryIcon"
    />
  </div>
  <div
    v-else-if="!isNull(secondaryText)"
    class="anzu-icon-group"
  >
    <VIcon
      :size="size"
      class="anzu-icon-group__main-icon"
      :icon="mainIcon"
    />
    <div class="anzu-icon-group__secondary-text">
      {{ secondaryText }}
    </div>
  </div>
  <VIcon
    v-else
    :icon="mainIcon"
  />
</template>

<style lang="scss">
// todo: move style values to variables, styled only for small version for now
.anzu-icon-group {
  position: relative;

  &__main-icon {
    position: relative;
    top: -2px;
    left: -2px;
  }

  &__secondary-icon {
    position: absolute;
    bottom: -6px;
    right: -6px;
    transform: scaleX(0.6) scaleY(0.6);
    border-radius: 100%;
  }

  &__secondary-text {
    padding: 2px;
    font-size: 10px;
    line-height: 13px;
    position: absolute;
    bottom: -4px;
    right: -4px;
    transform: scaleX(0.8) scaleY(0.8);
    border-radius: 100%;
    display: block;
    text-align: center;
    text-transform: uppercase;
    //width: 18px;
    //height: 18px;
  }
}

.v-theme--light {
  .anzu-icon-group {
    &__secondary-icon {
      background-color: white;
    }

    &__secondary-text {
      background-color: rgb(0 0 0 / 60%);
      color: white;
    }
  }
}

.v-theme--dark {
  .anzu-icon-group {
    &__secondary-icon {
      background-color: #363636;
    }

    &__secondary-text {
      background-color: #363636;
      color: white;
    }
  }
}

.v-btn--disabled.v-btn--icon {
  .anzu-icon-group {
    opacity: 0.45;
  }
}
</style>
