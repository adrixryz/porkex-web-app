import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '@/utils/api'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, title: 'Log in' }
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: 'Dashboard' }
    },
    {
      path: '/transactions',
      name: 'transactions',
      component: () => import('@/views/TransactionsView.vue'),
      meta: { title: 'Transactions' }
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/views/CategoriesView.vue'),
      meta: { title: 'Categories' }
    },
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('@/views/AnalyticsView.vue'),
      meta: { title: 'Analytics' }
    },
    {
      path: '/budgets',
      name: 'budgets',
      component: () => import('@/views/BudgetsView.vue'),
      meta: { title: 'Budgets' }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: 'Settings' }
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

// One place to name the tab, so every view does not have to.
router.afterEach(to => {
  const title = (to.meta as { title?: string }).title
  document.title = title ? `${title} · Porkex` : 'Porkex'
})

export default router
