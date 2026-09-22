import { createRouter, createWebHistory } from 'vue-router'

const Home = () => import('../views/Home.vue')
const Chat = () => import('../views/Chat.vue')
const TripList = () => import('../views/TripList.vue')
const Trip = () => import('../views/Trip.vue')
const Message = () => import('../views/Message.vue')
const Profile = () => import('../views/profile.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/chat', name: 'chat', component: Chat },
    // /trip 是行程列表（L1 落地页），/trip/:id 才是某一次行程的详情（L2）
    { path: '/trip', name: 'trip', component: TripList },
    { path: '/trip/:id', name: 'trip-detail', component: Trip },
    { path: '/message', name: 'message', component: Message },
    { path: '/profile', name: 'profile', component: Profile },
  ],
})

export default router
