import { createRouter, createWebHistory } from 'vue-router'

const Home = () => import('../views/Home.vue')
const Chat = () => import('../views/Chat.vue')
const Trip = () => import('../views/Trip.vue')
const Message = () => import('../views/Message.vue')
const Profile = () => import('../views/profile.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/chat', name: 'chat', component: Chat },
    { path: '/trip', name: 'trip', component: Trip },
    { path: '/message', name: 'message', component: Message },
    { path: '/profile', name: 'profile', component: Profile },
  ],
})

export default router
