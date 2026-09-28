// `@anzusystems/common-admin/testing`: the guard tests every admin carried as a copy. Test code only --
// it imports vitest, and the main entry never imports it.
export { type TypedRouterDeclaration, globKeyToSrcPath, parseTypedRouterDeclaration } from '@/testing/typedRouter'
export { type DescribeGeneratedRoutesOptions, describeGeneratedRoutes } from '@/testing/generatedRoutes'
export { type DescribeCloseButtonsOptions, describeCloseButtons } from '@/testing/closeButtons'
export { type DescribeRouteHistoryOptions, describeRouteHistory } from '@/testing/routeHistory'
export { type DescribeSortableListsOptions, describeSortableLists } from '@/testing/sortableLists'
export {
  CSS_LAYER_ORDER,
  CSS_LAYER_STATEMENTS,
  CSS_SUBLAYER_ORDER,
  type DescribeAlertHostOptions,
  describeAlertHost,
  describeCssLayerOrder,
} from '@/testing/appShell'
