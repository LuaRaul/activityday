
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: App },
    { path: '/activities', component: App },
    { path: '/habits', component: App },
    { path: '/goals', component: App },
    { path: '/reports', component: App },
    { path: '/calendar', component: App },
    { path: '/reminders', component: App },
    { path: '/account', component: App },
    { path: '/export', component: App },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

createApp(App).use(createPinia()).use(router).mount('#app')
