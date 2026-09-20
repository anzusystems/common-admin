import AFilterBooleanSelect from '@/labs/filters/AFilterBooleanSelect.vue'
import AFilterDatetimePicker from '@/labs/filters/AFilterDatetimePicker.vue'
import AFilterInteger from '@/labs/filters/AFilterInteger.vue'
import AFilterRemoteAutocomplete from '@/labs/filters/AFilterRemoteAutocomplete.vue'
import AFormRemoteAutocomplete from '@/labs/form/AFormRemoteAutocomplete.vue'
import AFormRemoteAutocompleteWithCached from '@/labs/form/AFormRemoteAutocompleteWithCached.vue'
import AFilterRemoteAutocompleteWithMinimal from '@/labs/filters/AFilterRemoteAutocompleteWithMinimal.vue'
import AFilterString from '@/labs/filters/AFilterString.vue'
import AFilterTimeInterval from '@/labs/filters/AFilterTimeInterval.vue'
import AFilterValueObjectOptionsSelect from '@/labs/filters/AFilterValueObjectOptionsSelect.vue'
import AFilterWrapper from '@/labs/filters/AFilterWrapper.vue'
import AFilterWrapperSidebar from '@/labs/filters/AFilterWrapperSidebar.vue'
import AFilterWrapperSubjectSelect from '@/labs/subjectSelect/AFilterWrapperSubjectSelect.vue'
import FiltersSelected from '@/labs/filters/FiltersSelected.vue'
import ADatatableOrdering from '@/labs/filters/ADatatableOrdering.vue'
import ADatatablePagination from '@/labs/filters/ADatatablePagination.vue'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import { useApiFetchItems } from '@/labs/api/useApiFetchItems'
import type { FetchItemsParams, UseApiFetchItemsParams, UseApiFetchItemsReturnType } from '@/labs/api/useApiFetchItems'
import type { FetchByIdsParams, UseApiFetchByIdsParams, UseApiFetchByIdsReturnType } from '@/labs/api/useApiFetchByIds'
import { useApiCommand, useApiRequest } from '@/labs/api/useApiRequest'
import type { ExecuteRequestParams, UseApiRequestParams, UseApiRequestReturnType } from '@/labs/api/useApiRequest'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/labs/api/apiErrors'
import type { ApiErrorContext, ApiErrorLogger } from '@/labs/api/apiErrors'
import { useApiFetchListBatch } from '@/labs/api/useApiFetchListBatch'
import type {
  FetchListBatchParams,
  UseApiFetchListBatchParams,
  UseApiFetchListBatchReturnType,
} from '@/labs/api/useApiFetchListBatch'
import { useApiQueryBuilder } from '@/labs/api/useApiQueryBuilder'
import { generateListQuery, useApiFetchList } from '@/labs/api/useApiFetchList'
import type { FetchListParams, UseApiFetchListParams, UseApiFetchListReturnType } from '@/labs/api/useApiFetchList'
import { useJobApi } from '@/labs/job/jobApi'
import ALogListView from '@/labs/log/ALogListView.vue'
import ALogDetailView from '@/labs/log/ALogDetailView.vue'
import {
  DEFAULT_LOG_PATHS,
  isLogType,
  LogType,
  LogTypeDefault,
  type LogPaths,
  type LogTypeType,
  useLogType,
} from '@/labs/log/logType'
import { applyLogTypeVisibility, useLogFilter, type LogFilter, type LogTimeWindow } from '@/labs/log/logFilter'
import { useLogDetailActions, useLogListActions } from '@/labs/log/logActions'
import { LOG_ENTITY, useFetchLog, useFetchLogList } from '@/labs/log/logApi'
import { formatJson } from '@/utils/json'
import {
  DatatablePaginationKey,
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
} from '@/labs/filters/filterInjectionKeys'
import {
  buildFilterHash,
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  isRouterSafeHash,
  type MakeFilterOption,
  useFilterHelpers,
} from '@/labs/filters/filterFactory'
import { TimeIntervalSpecialOptions, type TimeIntervalToolsValue } from '@/labs/filters/filterTimeIntervalTools'
import { type Pagination, usePagination } from '@/labs/filters/pagination'
import { createDatatableColumnsConfig } from '@/labs/filters/datatableColumns'
import { useSubjectSelect } from '@/labs/subjectSelect/useSubjectSelect'
import type { AxiosClientFn } from '@/labs/api/client'
import ASubjectSelect from '@/labs/subjectSelect/ASubjectSelect.vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import ANestedSortableListEditor from '@/labs/listEditor/ANestedSortableListEditor.vue'
import AUnsavedConfirmDialog from '@/labs/unsavedGuard/AUnsavedConfirmDialog.vue'
import { useUnsavedChangesGuard } from '@/labs/unsavedGuard/useUnsavedChangesGuard'
import { useGuardedDelete } from '@/labs/unsavedGuard/useGuardedDelete'
import {
  useUnsavedSection,
  type UnsavedSectionDescriptor,
  type UnsavedSectionSource,
} from '@/labs/unsavedGuard/useUnsavedSection'
import { useListEditor, type ListEditorApi } from '@/labs/listEditor/composables/useListEditor'
import {
  useListEditorController,
  type ListEditorHandle,
  type ExposedListEditorHandle,
  type UseListEditorControllerOptions,
  type ListEditorChanges,
  type ListEditorValidationResult,
  type GetKey,
  type PositionOption,
  type PositionStrategy,
  type PositionAction,
} from '@/labs/listEditor/composables/useListEditorController'
import {
  createListEditorStateScope,
  provideListEditorStateScope,
  useListEditorStateEntry,
  useNestedListEditorStateEntry,
  ListEditorStateScopeKey,
  type ListEditorStateScope,
  type ListEditorStateBindings,
  type NestedListEditorStateBindings,
  type ListEditorStateEntry,
} from '@/labs/listEditor/composables/useListEditorStateScope'
import {
  renumberPositions,
  sortByPosition,
  sortByPositionDeep,
  type RenumberPositionsOptions,
} from '@/labs/listEditor/utils/positions'
import { nextListEditorTempId } from '@/labs/listEditor/utils/tempId'
import { useNestedUnsavedKeys, type UseNestedUnsavedKeysApi } from '@/labs/listEditor/composables/useNestedUnsavedKeys'
import {
  type ReorderModeValue,
  type SharedReorderRegistry,
  SharedReorderRegistryKey,
} from '@/labs/listEditor/composables/useReorderMode'
import {
  useNestedListEditor,
  type NestedListEditorApi,
  type NestedViewItem,
} from '@/labs/listEditor/composables/useNestedListEditor'
import {
  useNestedListEditorController,
  type NestedListEditorHandle,
  type ExposedNestedListEditorHandle,
  type UseNestedListEditorControllerOptions,
  type NestedListEditorChanges,
} from '@/labs/listEditor/composables/useNestedListEditorController'
import type {
  ListEditorKey,
  ListEditorValidationState,
  ListViewItem,
  NestedPositionHint,
  NestedTree,
  NestedTreeNode,
  PositionHint,
  SortableNested,
  SortableNestedItem,
  UseListEditorOptions,
} from '@/labs/listEditor/types/listEditorTypes'
import { useUserAdminConfigApi } from '@/labs/filters/userAdminConfig'
import { useUserAdminConfigFactory } from '@/model/factory/UserAdminConfigFactory'
import {
  type UserAdminConfig,
  type UserAdminConfigDataFilterBookmark,
  type UserAdminConfigDataPinnedWidgets,
  UserAdminConfigLayoutType,
  UserAdminConfigLayoutTypeDefault,
  type UserAdminConfigLayoutTypeType,
  UserAdminConfigType,
  UserAdminConfigTypeDefault,
  type UserAdminConfigTypeType,
} from '@/types/UserAdminConfig'

export {
  // V2 FILTERS
  AFilterWrapper,
  AFilterWrapperSidebar,
  AFilterWrapperSubjectSelect,
  FiltersSelected,
  AFilterBooleanSelect,
  AFilterDatetimePicker,
  AFilterInteger,
  AFilterRemoteAutocomplete,
  AFilterRemoteAutocompleteWithMinimal,
  AFilterString,
  AFilterTimeInterval,
  AFilterValueObjectOptionsSelect,
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  ADatatableOrdering,
  ADatatablePagination,
  DatatablePaginationKey,
  AFormRemoteAutocomplete,
  AFormRemoteAutocompleteWithCached,
  buildFilterHash,
  createFilter,
  createFilterStore,
  isRouterSafeHash,
  useFilterHelpers,
  type FilterConfig,
  type FilterData,
  type FilterStore,
  type MakeFilterOption,
  TimeIntervalSpecialOptions,
  type TimeIntervalToolsValue,
  type Pagination,
  useApiFetchByIds,
  useApiFetchItems,
  useApiFetchList,
  useApiCommand,
  useApiRequest,
  // A wrapper around a helper has to be able to name what it returns and what it takes. Without
  // these the fleet can call the family but cannot write a function that hands one on, which is the
  // shape the admins are being moved towards.
  type UseApiRequestParams,
  type ExecuteRequestParams,
  type UseApiRequestReturnType,
  type UseApiFetchListParams,
  type FetchListParams,
  type UseApiFetchListReturnType,
  type UseApiFetchByIdsParams,
  type FetchByIdsParams,
  type UseApiFetchByIdsReturnType,
  type UseApiFetchItemsParams,
  type FetchItemsParams,
  type UseApiFetchItemsReturnType,
  type UseApiFetchListBatchParams,
  type FetchListBatchParams,
  type UseApiFetchListBatchReturnType,
  defaultApiErrorLogger,
  setApiErrorLogger,
  type ApiErrorContext,
  type ApiErrorLogger,
  useApiFetchListBatch,
  useApiQueryBuilder,
  generateListQuery,
  usePagination,
  createDatatableColumnsConfig,
  useSubjectSelect,
  ASubjectSelect,
  AListEditor,
  ASortableListEditor,
  ANestedSortableListEditor,
  AUnsavedConfirmDialog,
  useUnsavedChangesGuard,
  useGuardedDelete,
  useUnsavedSection,
  type UnsavedSectionDescriptor,
  type UnsavedSectionSource,
  useListEditor,
  useListEditorController,
  type ListEditorHandle,
  type ExposedListEditorHandle,
  type UseListEditorControllerOptions,
  type ListEditorChanges,
  type ListEditorValidationResult,
  type GetKey,
  type PositionOption,
  type PositionStrategy,
  type PositionAction,
  createListEditorStateScope,
  provideListEditorStateScope,
  useListEditorStateEntry,
  useNestedListEditorStateEntry,
  ListEditorStateScopeKey,
  type ListEditorStateScope,
  type ListEditorStateBindings,
  type NestedListEditorStateBindings,
  type ListEditorStateEntry,
  renumberPositions,
  sortByPosition,
  sortByPositionDeep,
  type RenumberPositionsOptions,
  nextListEditorTempId,
  useNestedUnsavedKeys,
  type UseNestedUnsavedKeysApi,
  type ReorderModeValue,
  type SharedReorderRegistry,
  SharedReorderRegistryKey,
  type ListEditorApi,
  useNestedListEditor,
  type NestedListEditorApi,
  type NestedViewItem,
  useNestedListEditorController,
  type NestedListEditorHandle,
  type ExposedNestedListEditorHandle,
  type UseNestedListEditorControllerOptions,
  type NestedListEditorChanges,
  type ListEditorKey,
  type ListEditorValidationState,
  type ListViewItem,
  type NestedPositionHint,
  type NestedTree,
  type NestedTreeNode,
  type PositionHint,
  type SortableNested,
  type SortableNestedItem,
  type UseListEditorOptions,
  useJobApi,
  type AxiosClientFn,
  useUserAdminConfigApi,
  type UserAdminConfig,
  UserAdminConfigType,
  UserAdminConfigTypeDefault,
  type UserAdminConfigTypeType,
  UserAdminConfigLayoutType,
  UserAdminConfigLayoutTypeDefault,
  type UserAdminConfigLayoutTypeType,
  type UserAdminConfigDataFilterBookmark,
  type UserAdminConfigDataPinnedWidgets,
  useUserAdminConfigFactory,
  ALogListView,
  ALogDetailView,
  LogType,
  LogTypeDefault,
  type LogTypeType,
  isLogType,
  useLogType,
  DEFAULT_LOG_PATHS,
  type LogPaths,
  useLogFilter,
  applyLogTypeVisibility,
  type LogFilter,
  type LogTimeWindow,
  useLogListActions,
  useLogDetailActions,
  useFetchLogList,
  useFetchLog,
  LOG_ENTITY,
  formatJson,
}
