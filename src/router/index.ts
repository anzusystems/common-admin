import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/component/row',
      name: 'component-row',
      component: () => import('@/views/components/RowView.vue'),
    },
    {
      path: '/component/boolean-value',
      name: 'component-boolean-value',
      component: () => import('@/views/components/BooleanValueView.vue'),
    },
    {
      path: '/component/permission',
      name: 'component-permission',
      component: () => import('@/views/components/PermissionView.vue'),
    },
    {
      path: '/component/datetime',
      name: 'component-datetime',
      component: () => import('@/views/components/DatetimeView.vue'),
    },
    {
      path: '/component/forms',
      name: 'component-forms',
      component: () => import('@/views/components/FormsView.vue'),
    },
    {
      path: '/component/filters',
      name: 'component-filters',
      component: () => import('@/views/components/FilterView.vue'),
    },
    {
      path: '/component/buttons',
      name: 'component-buttons',
      component: () => import('@/views/components/BtnView.vue'),
    },
    {
      path: '/component/asset-select',
      name: 'component-asset-select',
      component: () => import('@/views/components/AssetSelectView.vue'),
    },
  ],
})

export default router
