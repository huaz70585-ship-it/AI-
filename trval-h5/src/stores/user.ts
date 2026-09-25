import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const TOKEN_KEY = 'travel_token'

export interface UserProfile {
  id: string
  name: string
  avatar?: string
}

// 用户态：token / 资料 / 登录状态
export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) ?? '')
  const profile = ref<UserProfile | null>(null)

  const isLoggedIn = computed(() => !!token.value)

  function setToken(value: string) {
    token.value = value
    if (value) localStorage.setItem(TOKEN_KEY, value)
    else localStorage.removeItem(TOKEN_KEY)
  }

  function setProfile(value: UserProfile | null) {
    profile.value = value
  }

  function logout() {
    setToken('')
    setProfile(null)
  }

  return { token, profile, isLoggedIn, setToken, setProfile, logout }
})
