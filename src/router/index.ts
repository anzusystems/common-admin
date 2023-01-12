import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/components/boolean-value',
      name: 'boolean-value',
      component: () => import('../views/components/ABooleanValueView.vue')
    }
  ]
})

export default router
