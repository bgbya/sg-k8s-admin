import { createRouter, createWebHistory } from 'vue-router'
import PodsView from '../views/PodsView.vue'
import DeploymentsView from '../views/DeploymentsView.vue'
import StatefulSetsView from '../views/StatefulSetsView.vue'
import TerminalView from '../views/TerminalView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/pods'
    },
    {
      path: '/pods',
      name: 'pods',
      component: PodsView,
      meta: {
        keepAlive: true
      }
    },
    {
      path: '/deployments',
      name: 'deployments',
      component: DeploymentsView,
      meta: {
        keepAlive: true
      }
    },
    {
      path: '/statefulsets',
      name: 'statefulsets',
      component: StatefulSetsView,
      meta: {
        keepAlive: true
      }
    },
    {
      path: '/terminal',
      name: 'terminal',
      component: TerminalView,
      meta: {
        keepAlive: false
      }
    }
  ]
})

export default router
