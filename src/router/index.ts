import { createRouter, createWebHistory } from 'vue-router'
import HomepageView from '@/playground/HomepageView.vue'
import SettingsView from '@/playground/SettingsView.vue'
import BooleanValueView from '@/playground/booleanValueView/BooleanValueView.vue'
import PermissionView from '@/playground/permissionView/PermissionView.vue'
import DatetimeView from '@/playground/datetimeView/DatetimeView.vue'
import FormsView from '@/playground/formsView/FormsView.vue'
import FilterView from '@/playground/filterView/FilterView.vue'
import BtnSplitView from '@/playground/btnSplitView/BtnSplitView.vue'
import AssetSelectView from '@/playground/assetSelectView/AssetSelectView.vue'
import ApiFetchListBatchView from '@/playground/apiFetchListBatchView/ApiFetchListBatchView.vue'
import ImageView from '@/playground/imageView/ImageView.vue'
import FileView from '@/playground/fileView/FileView.vue'
import SortableView from '@/playground/sortableView/SortableView.vue'
import { initLanguageMessagesLoaded, initLoadLanguageMessages } from '@/playground/system/loadLanguageMessages'
import AlertView from '@/playground/alertView/AlertView.vue'
import SubjectSelectView from '@/playground/subjectSelectView/SubjectSelectView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomepageView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/view/boolean-value',
      name: 'view-boolean-value',
      component: BooleanValueView,
    },
    {
      path: '/view/permission',
      name: 'view-permission',
      component: PermissionView,
    },
    {
      path: '/view/datetime',
      name: 'view-datetime',
      component: DatetimeView,
    },
    {
      path: '/view/forms',
      name: 'view-forms',
      component: FormsView,
    },
    {
      path: '/view/filters',
      name: 'view-filters',
      component: FilterView,
    },
    {
      path: '/view/split-buttons',
      name: 'view-split-buttons',
      component: BtnSplitView,
    },
    {
      path: '/view/subject-select',
      name: 'view-subject-select',
      component: SubjectSelectView,
    },
    {
      path: '/view/asset-select',
      name: 'view-asset-select',
      component: AssetSelectView,
    },
    {
      path: '/view/image',
      name: 'view-image',
      component: ImageView,
    },
    {
      path: '/view/file',
      name: 'view-file',
      component: FileView,
    },
    {
      path: '/view/sortable',
      name: 'view-sortable',
      component: SortableView,
    },
    {
      path: '/view/alert',
      name: 'view-alert',
      component: AlertView,
    },
    {
      path: '/view/fetch-batch',
      name: 'view-fetch-batch',
      component: ApiFetchListBatchView,
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  if (!initLanguageMessagesLoaded.value) await initLoadLanguageMessages()
  next()
})

export default router
