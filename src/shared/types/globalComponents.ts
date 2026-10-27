import type { RouterLink, RouterView } from 'vue-router'
import type { VBtn } from 'vuetify/components'
import type Acl from '@/domains/auth/components/Acl.vue'
import type AChipNoLink from '@/domains/ui/components/AChipNoLink.vue'

/**
 * Global components the library registers, typed for templates: the button aliases from
 * `useCommonVuetifyConfig().commonAliases`, plus `Acl` and `AChipNoLink` registered by the plugin.
 * Their names are `globalComponentNames` in `@anzusystems/common-admin/eslint`.
 * The augmentations live in this module because the public entry
 * re-exports it, so an admin's program loads them with the declarations.
 */
export interface CommonAdminGlobalComponents {
  ABtnPrimary: typeof VBtn
  ABtnSecondary: typeof VBtn
  ABtnTertiary: typeof VBtn
  ABtnIcon: typeof VBtn
  AChipNoLink: typeof AChipNoLink
  /**
   * Its `permission` takes the values an admin puts in `AclRegistry`.
   */
  Acl: typeof Acl
}

declare module 'vue' {
  export interface GlobalComponents extends CommonAdminGlobalComponents {
    RouterLink: typeof RouterLink
    RouterView: typeof RouterView
  }

  interface AllowedComponentProps {
    dataCy?: string
  }
}
