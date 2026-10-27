// Its own module, without the preset's node imports: a browser test imports it as well.
/**
 * The components the library registers globally: the Vuetify button aliases and the
 * plugin's `Acl` and `AChipNoLink`. For the `ignorePatterns` of `vue/no-undef-components`.
 * A test keeps it equal to the registrations and to `CommonAdminGlobalComponents`.
 */
export const globalComponentNames = Object.freeze([
  'ABtnPrimary',
  'ABtnSecondary',
  'ABtnTertiary',
  'ABtnIcon',
  'AChipNoLink',
  'Acl',
])
