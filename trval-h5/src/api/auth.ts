import { request } from '../utils/request'
import type { UserProfile } from '../stores/user'

// ── 契约 ─────────────────────────────────────────────────────
// POST /v1/auth/sms-code       {phone}              → 60s 限流
// POST /v1/auth/login          {phone, code}        → { token, user }  验证码登录
// POST /v1/auth/register       {username, password, phone?} → { token, user }  注册
// POST /v1/auth/login-password {account, password}  → { token, user }  账号密码登录
// token 交由 stores/user.ts 持久化（localStorage「travel_token」）
// ────────────────────────────────────────────────────────────

export interface LoginResult {
  token: string
  user: UserProfile
}

// MOCK 开关：后端 /v1/auth 就绪后改为 false 即切真接口（本文件其余不动）
const USE_MOCK = false

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** 获取短信验证码（mock 阶段无实际下发，任意 4-6 位验证码均可登录） */
export async function requestSmsCode(phone: string): Promise<void> {
  if (!USE_MOCK) {
    await request({ url: '/v1/auth/sms-code', method: 'POST', data: { phone } })
    return
  }
  await sleep(500)
}

/** 验证码登录（输码即注册） */
export async function loginBySms(params: { phone: string; code: string }): Promise<LoginResult> {
  if (!USE_MOCK) {
    return request<LoginResult>({ url: '/v1/auth/login', method: 'POST', data: params })
  }
  await sleep(700)
  if (params.code.length < 4) {
    throw new Error('验证码错误')
  }
  return {
    token: `mock-token-${params.phone}-${Date.now()}`,
    user: {
      id: `u_${params.phone.slice(-4)}`,
      name: `旅客${params.phone.slice(-4)}`,
    },
  }
}

/** 账号密码注册 */
export async function register(params: {
  username: string
  password: string
  phone?: string
}): Promise<LoginResult> {
  return request<LoginResult>({ url: '/v1/auth/register', method: 'POST', data: params })
}

/** 账号密码登录（account 可为用户名或手机号） */
export async function loginByPassword(params: {
  account: string
  password: string
}): Promise<LoginResult> {
  return request<LoginResult>({ url: '/v1/auth/login-password', method: 'POST', data: params })
}
