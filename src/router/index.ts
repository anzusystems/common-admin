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
import { initLanguageMessagesLoaded, initLoadLanguageMessages } from '@/playground/system/loadLanguageMessages'

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
      path: '/view/asset-select',
      name: 'view-asset-select',
      component: AssetSelectView,
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  if (!initLanguageMessagesLoaded.value) await initLoadLanguageMessages()
  next()
})

export default router
