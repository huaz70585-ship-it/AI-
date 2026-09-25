import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const Home = () => import('../views/Home.vue')
const Chat = () => import('../views/Chat.vue')
const TripList = () => import('../views/TripList.vue')
const Trip = () => import('../views/Trip.vue')
const Message = () => import('../views/Message.vue')
const Profile = () => import('../views/profile.vue')
const Login = () => import('../views/Login.vue')

// 需要登录才能访问的路由
const AUTH_ROUTES = ['chat', 'trip', 'trip-detail', 'message', 'profile']

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
    { path: '/login', name: 'login', component: Login },
  ],
})

// 全局前置守卫
router.beforeEach((to) => {
  const userStore = useUserStore()

  // 已登录 → 禁止进登录页，踢回首页
  if (to.name === 'login' && userStore.isLoggedIn) {
    return { name: 'home' }
  }

  // 未登录 → 访问需登录的路由，踢去登录页
  if (AUTH_ROUTES.includes(to.name as string) && !userStore.isLoggedIn) {
    return { name: 'login' }
  }
})

export default router
