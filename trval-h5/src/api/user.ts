import { request } from '../utils/request'

export interface UserProfile {
  id: string
  name: string
  avatar?: string
}

export interface Footprint {
  city_count: number
  travel_days: number
  total_km: number
  progress: number
}

/** 当前用户资料 */
export function getProfile(): Promise<UserProfile> {
  return request<UserProfile>({ url: '/v1/user/profile', method: 'GET' })
}

/** 修改昵称 / 头像（base64） */
export function updateProfile(params: { name?: string; avatar?: string }): Promise<UserProfile> {
  return request<UserProfile>({ url: '/v1/user/profile', method: 'PATCH', data: params })
}

/** 专用头像上传（base64） */
export function uploadAvatar(avatar: string): Promise<{ avatar: string }> {
  return request<{ avatar: string }>({ url: '/v1/user/avatar', method: 'POST', data: { avatar } })
}

/** 足迹统计 */
export function getFootprints(): Promise<Footprint> {
  return request<Footprint>({ url: '/v1/user/footprints', method: 'GET' })
}
