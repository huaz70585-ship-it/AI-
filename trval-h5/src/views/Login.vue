<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { requestSmsCode, loginBySms, loginByPassword, register } from '../api/auth'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()

// 锁死 body 滚动，离开时恢复
onMounted(() => {
  document.body.style.overflow = 'hidden'
  document.body.style.position = 'fixed'
  document.body.style.width = '100%'
  document.body.style.height = '100%'
})
onUnmounted(() => {
  document.body.style.overflow = ''
  document.body.style.position = ''
  document.body.style.width = ''
  document.body.style.height = ''
})

type Mode = 'sms' | 'password' | 'register'
const mode = ref<Mode>('password')

const phone = ref('')
const code = ref('')
const account = ref('')
const password = ref('')
const regUsername = ref('')
const regPassword = ref('')
const regPhone = ref('')
const agreed = ref(false)
const sending = ref(false)
const submitting = ref(false)

const phoneValid = computed(() => /^1\d{10}$/.test(phone.value))

// 60s 验证码倒计时
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
function startCountdown() {
  countdown.value = 60
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function finishLogin(token: string, user: any) {
  userStore.setToken(token)
  userStore.setProfile(user)
  showToast(mode.value === 'register' ? '注册成功' : '登录成功')
  router.replace('/')
}

async function onSendCode() {
  if (countdown.value > 0 || sending.value) return
  if (!phoneValid.value) {
    showToast('请输入正确的手机号')
    return
  }
  sending.value = true
  try {
    await requestSmsCode(phone.value)
    startCountdown()
    showToast('验证码已发送')
  } catch {
    // 错误提示由请求层统一 toast
  } finally {
    sending.value = false
  }
}

/* 验证码登录 */
async function onLogin() {
  if (!agreed.value) {
    showToast('请先阅读并同意《用户协议》和《隐私政策》')
    return
  }
  if (!phoneValid.value) return showToast('请输入正确的手机号')
  if (code.value.length < 4) return showToast('请输入验证码')
  submitting.value = true
  try {
    const { token, user } = await loginBySms({ phone: phone.value, code: code.value })
    finishLogin(token, user)
  } catch {
  } finally {
    submitting.value = false
  }
}

/* 账号密码登录 */
async function onPasswordLogin() {
  if (!agreed.value) return showToast('请先阅读并同意《用户协议》和《隐私政策》')
  if (!account.value.trim()) return showToast('请输入账号')
  if (!password.value) return showToast('请输入密码')
  submitting.value = true
  try {
    const { token, user } = await loginByPassword({
      account: account.value.trim(),
      password: password.value,
    })
    finishLogin(token, user)
  } catch {
  } finally {
    submitting.value = false
  }
}

/* 注册 */
async function onRegister() {
  if (!agreed.value) return showToast('请先阅读并同意《用户协议》和《隐私政策》')
  if (!regUsername.value.trim() || regUsername.value.length < 3) return showToast('用户名至少 3 位')
  if (!regPassword.value || regPassword.value.length < 6) return showToast('密码至少 6 位')
  if (regPhone.value && !/^1\d{10}$/.test(regPhone.value)) return showToast('手机号格式不正确')
  submitting.value = true
  try {
    const { token, user } = await register({
      username: regUsername.value.trim(),
      password: regPassword.value,
      phone: regPhone.value || undefined,
    })
    finishLogin(token, user)
  } catch {
  } finally {
    submitting.value = false
  }
}

function onWechat() { showToast('微信登录即将开放') }
function onApple() { showToast('Apple 登录即将开放') }
function onGuest() { router.replace('/') }
function onBack() { router.back() }
</script>

<template>
  <div class="login-page">
    <!-- 导航：仅返回 -->
    <van-nav-bar left-arrow :border="false" @click-left="onBack" />

    <!-- 品牌区 -->
    <header class="brand">
      <div class="brand__logo">
        <img src="/logo.svg" alt="途灵" width="48" height="48" />
      </div>
      <h1 class="brand__name">途灵</h1>
      <p class="brand__slogan">先有灵光，再上路</p>
    </header>

    <!-- 表单卡 -->
    <section class="form-card">
      <!-- 验证码登录 -->
      <template v-if="mode === 'sms'">
        <div class="row">
          <span class="row__prefix">+86</span>
          <i class="row__sep" />
          <input
            v-model="phone"
            class="row__input"
            type="tel"
            maxlength="11"
            placeholder="请输入手机号"
          >
        </div>
        <div class="row-divider" />
        <div class="row">
          <input
            v-model="code"
            class="row__input"
            type="number"
            maxlength="6"
            placeholder="请输入验证码"
          >
          <button
            class="code-btn"
            :disabled="countdown > 0 || sending"
            @click="onSendCode"
          >
            {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
          </button>
        </div>
        <button class="login-btn" :disabled="submitting" @click="onLogin">
          {{ submitting ? '登录中…' : '登  录' }}
        </button>
      </template>

      <!-- 账号密码登录 -->
      <template v-else-if="mode === 'password'">
        <div class="row">
          <van-icon name="user-o" class="row__icon" />
          <i class="row__sep" />
          <input
            v-model="account"
            class="row__input"
            type="text"
            placeholder="用户名或手机号"
          >
        </div>
        <div class="row-divider" />
        <div class="row">
          <van-icon name="lock" class="row__icon" />
          <i class="row__sep" />
          <input
            v-model="password"
            class="row__input"
            type="password"
            placeholder="请输入密码"
          >
        </div>
        <button class="login-btn" :disabled="submitting" @click="onPasswordLogin">
          {{ submitting ? '登录中…' : '登  录' }}
        </button>
      </template>

      <!-- 注册 -->
      <template v-else>
        <div class="row">
          <van-icon name="user-o" class="row__icon" />
          <i class="row__sep" />
          <input
            v-model="regUsername"
            class="row__input"
            type="text"
            maxlength="20"
            placeholder="设置用户名（至少 3 位）"
          >
        </div>
        <div class="row-divider" />
        <div class="row">
          <van-icon name="lock" class="row__icon" />
          <i class="row__sep" />
          <input
            v-model="regPassword"
            class="row__input"
            type="password"
            placeholder="设置密码（至少 6 位）"
          >
        </div>
        <div class="row-divider" />
        <div class="row">
          <span class="row__prefix">+86</span>
          <i class="row__sep" />
          <input
            v-model="regPhone"
            class="row__input"
            type="tel"
            maxlength="11"
            placeholder="手机号（选填）"
          >
        </div>
        <button class="login-btn" :disabled="submitting" @click="onRegister">
          {{ submitting ? '注册中…' : '注  册' }}
        </button>
      </template>
    </section>

    <!-- 切换链接：登录/注册互切，验证码/密码互切 -->
    <div class="switch-row">
      <template v-if="mode === 'register'">
        <span class="switch-row__text">已有账号？</span>
        <button class="switch-row__link" @click="mode = 'sms'">去登录</button>
      </template>
      <template v-else>
        <button class="switch-row__link" @click="mode = mode === 'sms' ? 'password' : 'sms'">
          {{ mode === 'sms' ? '账号密码登录' : '验证码登录' }}
        </button>
        <span class="switch-row__sep">·</span>
        <button class="switch-row__link" @click="mode = 'register'">注册新账号</button>
      </template>
    </div>

    <!-- 协议勾选（合规硬要求） -->
    <div class="agree" @click="agreed = !agreed">
      <span class="agree__box" :class="{ 'is-checked': agreed }">
        <van-icon v-if="agreed" name="success" />
      </span>
      <p class="agree__text">
        已阅读并同意<span class="agree__link">《用户协议》</span>和<span class="agree__link">《隐私政策》</span>
      </p>
    </div>

    <!-- 第三方登录 -->
    <div class="divider">
      <i /><span>其他登录方式</span><i />
    </div>
    <div class="social">
      <button class="social__btn social__btn--wechat" aria-label="微信登录" @click="onWechat">
        <!-- 微信双气泡（品牌图形，色值固定） -->
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 5C6.6 5 3 8 3 11.7c0 2.1 1.1 3.9 2.9 5.2L5.2 19.6l2.9-1.5c.9.3 1.9.4 2.9.4h.4c-.3-.7-.4-1.4-.4-2.1 0-3.5 3.3-6.3 7.3-6.3h.4C18 7.3 14.8 5 11 5z" fill="white" />
          <circle cx="8.6" cy="10.2" r="1" fill="#0e7c86" />
          <circle cx="13.4" cy="10.2" r="1" fill="#0e7c86" />
          <path d="M25 16.5c0-3-3-5.5-6.6-5.5S11.8 13.5 11.8 16.5s3 5.5 6.6 5.5c.8 0 1.6-.1 2.3-.3l2.5 1.3-.7-2.2c1.6-1 2.5-2.6 2.5-4.3z" fill="white" />
          <circle cx="15.8" cy="15.8" r="0.9" fill="#0e7c86" />
          <circle cx="19.4" cy="15.8" r="0.9" fill="#0e7c86" />
        </svg>
      </button>
      <button class="social__btn social__btn--apple" aria-label="Apple 登录" @click="onApple">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16.7 12.8c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1 0 1.4-.6 2.6-.6s1.6.6 2.6.6c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.2-.9-2.2-3zM14.8 6.6c.5-.7.9-1.6.8-2.6-.8 0-1.8.6-2.3 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.3-1.1z" fill="white" />
        </svg>
      </button>
    </div>

    <!-- 游客入口：先逛后登录 -->
    <footer class="guest" @click="onGuest">
      先逛逛，稍后登录<span class="guest__arrow">›</span>
    </footer>
  </div>
</template>

<style scoped>
.login-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100dvh;
  overflow: hidden;
  background: var(--c-bg);
  font-family: var(--font-sans);
  display: flex;
  flex-direction: column;
  padding: 0 20px calc(env(safe-area-inset-bottom, 0px) + 20px);
}

/* 导航透明化，与品牌区融为一体 */
.login-page :deep(.van-nav-bar) {
  background: transparent;
}
.login-page :deep(.van-nav-bar .van-icon) {
  color: var(--c-text);
  font-size: 20px;
}

/* ── 品牌区 ─────────────────────────── */
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 26px 0 30px;
}
.brand__logo {
  width: 76px;
  height: 76px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;  /* 图标本体是青绿，压在蓝渐变上会糊，改白底 */
  box-shadow: 0 8px 20px rgba(14, 124, 134, 0.28);
}
.brand__name {
  margin: 0;
  font-size: 23px;
  font-weight: 700;
  color: var(--c-text);
}
.brand__slogan {
  margin: 0;
  font-size: 13px;
  color: var(--c-sub);
}

/* ── 表单卡 ─────────────────────────── */
.form-card {
  background: var(--c-card);
  border-radius: 14px;
  padding: 8px 20px 20px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
}
.row__prefix {
  font-size: 16px;
  font-weight: 600;
  color: var(--c-text);
}
.row__sep {
  width: 1px;
  height: 18px;
  background: var(--c-divider);
}
.row__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: var(--c-text);
  font-family: inherit;
}
.row__input::placeholder {
  color: #c0c6cf;
}
.row-divider {
  height: 1px;
  background: var(--c-divider);
}
.code-btn {
  flex-shrink: 0;
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 16px;
  background: var(--c-brand-soft);
  color: var(--c-brand);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
}
.code-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
.login-btn {
  width: 100%;
  height: 48px;
  margin-top: 16px;
  border: none;
  border-radius: 24px;
  background: var(--c-brand);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  letter-spacing: 2px;
  cursor: pointer;
  box-shadow: 0 6px 14px rgba(14, 124, 134, 0.3);
}
.login-btn:disabled {
  opacity: 0.7;
}

/* ── 切换链接行 ─────────────────────── */
.switch-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 16px;
}
.switch-row__text {
  font-size: 13px;
  color: var(--c-sub);
}
.switch-row__link {
  border: none;
  background: transparent;
  padding: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-brand);
  font-family: inherit;
  cursor: pointer;
}
.switch-row__sep {
  font-size: 12px;
  color: var(--c-divider);
}

/* ── 行内图标 ─────────────────────────── */
.row__icon {
  font-size: 18px;
  color: var(--c-muted);
  flex-shrink: 0;
}
/* ── 协议勾选 ───────────────────────── */
.agree {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 18px 4px 0;
  cursor: pointer;
}
.agree__box {
  flex-shrink: 0;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  border: 1.4px solid var(--c-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.agree__box.is-checked {
  background: var(--c-brand);
  border-color: var(--c-brand);
  color: #fff;
  font-size: 11px;
}
.agree__text {
  margin: 0;
  font-size: 12px;
  color: var(--c-sub);
}
.agree__link {
  color: var(--c-brand);
}

/* ── 第三方登录 ─────────────────────── */
.divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 44px;
  height: 18px;
}
.divider i {
  flex: 1;
  height: 1px;
  background: var(--c-divider);
}
.divider span {
  font-size: 12px;
  color: var(--c-muted);
}
.social {
  display: flex;
  justify-content: center;
  gap: 28px;
  margin-top: 26px;
}
.social__btn {
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.social__btn--wechat {
  background: #07c160; /* 微信品牌色，非产品 token */
}
.social__btn--apple {
  background: #000;
}

/* ── 游客入口 ───────────────────────── */
.guest {
  margin-top: auto;
  padding-top: 40px;
  text-align: center;
  font-size: 13px;
  color: var(--c-sub);
  cursor: pointer;
}
.guest__arrow {
  margin-left: 4px;
  font-size: 15px;
}
</style>
