import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios'
import { showToast } from 'vant'
import { useUserStore } from '../stores/user'

// Axios 实例：统一 baseURL、超时、鉴权头、错误处理
const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
})

// 请求拦截：携带 token
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const userStore = useUserStore()
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截：解包 data、处理业务码与 401
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data
    // 约定后端结构 { code, data, message }
    if (res && typeof res === 'object' && 'code' in res) {
      if (res.code === 0 || res.code === 200) return res.data
      showToast(res.message ?? '请求失败')
      return Promise.reject(new Error(res.message ?? 'Error'))
    }
    return res
  },
  (error: AxiosError) => {
    const status = error.response?.status
    if (status === 401) {
      const userStore = useUserStore()
      userStore.logout()
      showToast('登录已过期，请重新登录')
    } else {
      showToast(error.message ?? '网络异常')
    }
    return Promise.reject(error)
  },
)

// 便捷请求方法，返回解包后的 data
export function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  return service(config) as unknown as Promise<T>
}

export default service
