// Its own module, without the preset's node imports: a browser test imports it as well.
/**
 * The components the library registers globally -- the button aliases of its Vuetify config and the
 * plugin's `Acl` and `AChipNoLink` -- for the `ignorePatterns` of `vue/no-undef-components`. Kept equal to the
 * registrations (and to `CommonAdminGlobalComponents`) by a test. Admins used to read the aliases out
 * of the rolled-up declarations with a regex, which the per-module declarations no longer allow.
 */
export const globalComponentNames = Object.freeze([
  'ABtnPrimary',
  'ABtnSecondary',
  'ABtnTertiary',
  'ABtnIcon',
  'AChipNoLink',
  'Acl',
])
