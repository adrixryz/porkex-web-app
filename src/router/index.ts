import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '@/utils/api'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue')
    },
    {
      path: '/transactions',
      name: 'transactions',
      component: () => import('@/views/TransactionsView.vue')
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/views/CategoriesView.vue')
    },
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('@/views/AnalyticsView.vue')
    },
    {
      path: '/budgets',
      name: 'budgets',
      component: () => import('@/views/BudgetsView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    },
    // Catch-all: unknown routes fall back to the dashboard (or login when signed out)
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/'
    }
  ]
})

// Navigation guard
router.beforeEach((to, _from, next) => {
  if (to.meta.public) {
    // If already logged in, redirect to dashboard
    if (isAuthenticated() && to.name === 'login') {
      return next('/')
    }
    return next()
  }

  // Protected route - check auth
  if (!isAuthenticated()) {
    return next('/login')
  }
  next()
})

export default router
