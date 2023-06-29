<script lang="ts" setup>
import AssetSelectTilesItem from '@/components/dam/assetSelect/components/AssetSelectTilesItem.vue'
import { useGridView } from '@/components/dam/assetSelect/composables/assetSelectGridView'
import { useAssetListActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { useI18n } from 'vue-i18n'

const { gridView } = useGridView()
const { onItemClick, assetListItems, loader } = useAssetListActions()

const { t } = useI18n()
</script>

<template>
  <div
    class="asset-list-tiles"
    :class="'asset-list-tiles--' + gridView"
  >
    <AssetSelectTilesItem
      v-for="(item, index) in assetListItems"
      :key="item.asset.id"
      :index="index"
      :item="item"
      @item-click="onItemClick"
    />
  </div>
  <div
    v-if="!loader && assetListItems.length === 0"
    class="text-h6 text-medium-emphasis d-flex w-100 h-100 align-center justify-center"
  >
    {{ t('common.assetSelect.meta.texts.noItemsFound') }}
  </div>
</template>

<style lang="scss">
// css similar to '.dam-image-grid' in admin-dam, for now renamed here to new class to avoid conflicts
// consider refactor later according how much different both versions will be

$class-name-root: 'asset-list-tiles';
$bg-color-light: #f9f9f9;
$bg-color-dark: #1e1e1e;
$border-color-light: #e8e9ea;
$border-color-dark: #2c2c2c;
$shadow-color-light: #959595;
$shadow-color-dark: #3d3d3d;
$bg-color-actions-light: #fff;
$bg-color-actions-dark: #1a1a1a;

.#{$class-name-root} {
  display: flex;
  flex-wrap: wrap;
  max-width: 100%;
  padding: 2px;

  &__item {
    cursor: pointer;
    user-select: none;
    flex-grow: 2;
    max-width: 800px;
    padding: 10px;
    position: relative;
    overflow: hidden;
    min-width: 200px;

    &-card {
      border-radius: 5px;
      overflow: hidden;

      img:not(.img-svg) {
        display: block;
        height: 200px;
        min-width: 100%;
        object-fit: cover;
        width: 100%;
      }

      &:hover {
        .#{$class-name-root}__item-card-actions {
          display: block;
        }
      }

      &-actions {
        border-radius: 4px;
        position: absolute;
        top: -2px;
        right: -5px;
        display: none;
        overflow: hidden;
      }
    }

    &-text,
    &-text .line-clamp-1 {
      font-weight: 500;
      line-height: 30px;
      min-height: 38px;
      max-height: 38px;
    }
  }

  &--thumbnail {
    display: grid;
    grid-template-columns: repeat(6, auto);

    .#{$class-name-root}__item {
      img:not(.img-svg) {
        object-fit: contain;
        padding-left: 6px;
        padding-right: 6px;
        padding-top: 6px;
        background-color: transparent !important;
      }
    }
  }

  .#{$class-name-root}__selected-triangle {
    position: absolute;
    top: 11px;
    right: 11px;
    z-index: 1;

    &__bg {
      content: '';
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 0 30px 30px 0;
      border-color: transparent #608a32 transparent transparent;
      top: 0;
      right: 0;
      position: absolute;
    }

    &__icon {
      position: absolute;
      display: block;
      width: 16px;
      height: 16px;
      top: -3px;
      right: 0;
    }
  }
}

.v-theme--light {
  .#{$class-name-root} {
    &__item {
      &-card {
        background-color: $bg-color-light;
        border: 1px solid $border-color-light;

        &:hover {
          box-shadow: 0 0 3px 1px $shadow-color-light;
        }

        &-actions {
          background-color: $bg-color-actions-light;
        }
      }

      &--selected {
        .#{$class-name-root}__item-card {
          border-color: #608a32;
        }
      }

      &--active {
        .#{$class-name-root}__item-card {
          border-color: blue;
        }
      }
    }
  }
}

.v-theme--dark {
  .#{$class-name-root} {
    &__item {
      &-card {
        background-color: $bg-color-dark;
        border: 1px solid $border-color-dark;

        &:hover {
          box-shadow: 0 0 3px 1px $shadow-color-dark;
        }

        &-actions {
          background-color: $bg-color-actions-dark;
        }
      }

      &--selected {
        .#{$class-name-root}__item-card {
          border-color: #608a32;
        }
      }

      &--active {
        .#{$class-name-root}__item-card {
          border-color: blue;
        }
      }
    }
  }
}
</style>
