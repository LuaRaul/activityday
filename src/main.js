import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/activities' },
    { path: '/activities', component: App },
    { path: '/calendar', component: App },
    { path: '/reminders', component: App },
    { path: '/account', component: App },
    { path: '/export', component: App },
    { path: '/:pathMatch(.*)*', redirect: '/activities' },
  ],
  scrollBehavior() { return { top: 0 } },
})

createApp(App).use(createPinia()).use(router).mount('#app')
