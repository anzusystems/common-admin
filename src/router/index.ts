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
      component: () => import('@/views/components/ARowView.vue'),
    },
    {
      path: '/component/boolean-value',
      name: 'component-boolean-value',
      component: () => import('@/views/components/ABooleanValueView.vue'),
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
  ],
})

export default router
