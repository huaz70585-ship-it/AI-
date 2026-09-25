<template>
  <div class="profile">
    <!-- Hero · 蓝色渐变主角区（全页唯一大色块） -->
    <header class="hero">
      <div class="hero__inner">
        <div class="hero__user">
          <div class="hero__avatar">
            <img v-if="userStore.profile?.avatar" :src="userStore.profile.avatar" alt="" class="hero__avatar-img">
            <van-icon v-else name="user-o" />
          </div>
          <div class="hero__info">
            <h1 class="hero__name">{{ userStore.profile?.name || '未登录' }}</h1>
            <div class="hero__tags">
              <span class="hero__tag">已解锁 {{ foot.city_count }} 城</span>
            </div>
          </div>
        </div>
        <button class="hero__edit" aria-label="编辑资料" @click="onEditProfile">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2.5l1.6 4.6 4.6 1.6-4.6 1.6L12 14.9l-1.6-4.6L5.8 8.7l4.6-1.6L12 2.5Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- 足迹卡 · 主角（白卡压在 hero 上） -->
    <section class="tracks">
      <div class="tracks__head">
        <span class="tracks__title">我的足迹</span>
      </div>
      <div class="tracks__stats">
        <div class="stat">
          <span class="stat__num">{{ foot.city_count }}</span>
          <span class="stat__label">到访城市</span>
        </div>
        <span class="stat__sep"></span>
        <div class="stat">
          <span class="stat__num">{{ foot.travel_days }}</span>
          <span class="stat__label">旅行天数</span>
        </div>
        <span class="stat__sep"></span>
        <div class="stat">
          <span class="stat__num">{{ foot.total_km.toLocaleString() }}</span>
          <span class="stat__label">累计公里</span>
        </div>
      </div>
      <div class="tracks__progress">
        <span
          v-for="i in 10"
          :key="i"
          class="tracks__dot"
          :class="{ 'is-on': i <= foot.progress }"
        ></span>
      </div>
    </section>

    <!-- 我的行程（AI 落点：状态展示，不加新入口） -->
    <section class="block">
      <div class="block__head">
        <h3 class="block__title">我的行程</h3>
        <button class="block__more" @click="router.push('/trip')">
          全部 {{ trips.length }} 个 <van-icon name="arrow" />
        </button>
      </div>

      <article v-if="featured" class="trip" @click="router.push(`/trip/${featured.id}`)">
        <div class="trip__body">
          <p class="trip__route">{{ featured.title }}</p>
          <p class="trip__meta">{{ featured.dateRange }} · {{ featured.people }}人</p>
          <span class="trip__ai">
            <van-icon name="medal-o" /> AI 已优化行程
          </span>
        </div>
        <div class="trip__media">
          <img :src="tripImage" alt="" class="trip__img" />
          <div class="trip__overlay"></div>
          <span class="trip__badge">{{ featured.stateText }}</span>
        </div>
      </article>
    </section>

    <!-- 设置列表 -->
    <section class="settings">
      <van-cell-group :border="false" inset>
        <van-cell title="帮助与客服" icon="service-o" is-link size="large" />
        <van-cell title="意见反馈" icon="comment-o" is-link size="large" />
        <van-cell title="通用设置" icon="setting-o" is-link size="large" @click="openSettings" />
        <van-cell title="关于我们" icon="info-o" is-link size="large" />
      </van-cell-group>
    </section>

    <!-- 编辑资料 · 头像 + 昵称（底部弹出） -->
    <van-popup
      v-model:show="editProfileOpen"
      position="bottom"
      round
      :style="{ maxHeight: '80%' }"
      closeable
    >
      <div class="edit-panel">
        <h3 class="edit-panel__title">编辑资料</h3>

        <!-- 头像：显示当前/预览新图，点击换图 -->
        <div class="edit-panel__avatar-wrap" @click="onPickAvatar">
          <div class="edit-panel__avatar">
            <img v-if="editAvatar" :src="editAvatar" alt="" class="edit-panel__avatar-img">
            <img v-else-if="userStore.profile?.avatar" :src="userStore.profile.avatar" alt="" class="edit-panel__avatar-img">
            <van-icon v-else name="user-o" class="edit-panel__avatar-icon" />
          </div>
          <span class="edit-panel__avatar-hint">点击更换头像</span>
        </div>

        <!-- 昵称：预填当前值 -->
        <div class="edit-panel__field">
          <label class="edit-panel__label">昵称</label>
          <input
            v-model="editName"
            class="edit-panel__input"
            type="text"
            maxlength="20"
            :placeholder="userStore.profile?.name || '请输入昵称'"
          >
        </div>

        <button class="edit-panel__save" :disabled="editSaving" @click="onSaveProfile">
          {{ editSaving ? '保存中…' : '保存' }}
        </button>
      </div>
    </van-popup>

    <!-- 通用设置 · 二级菜单（底部弹出） -->
    <van-popup
      v-model:show="settingsOpen"
      position="bottom"
      round
      :style="{ maxHeight: '70%' }"
      closeable
    >
      <div class="settings-panel">
        <h3 class="settings-panel__title">通用设置</h3>
        <van-cell-group :border="false">
          <van-cell
            title="退出登录"
            icon="log-out"
            is-link
            size="large"
            class="logout-cell"
            @click="onLogout"
          />
        </van-cell-group>
        <div class="settings-panel__tip">已登录账号将被清除</div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import {
  getTrips,
  formatDateRange,
  travelerCount,
  deriveTripState,
  type TripListItem,
} from '../api/travel'
import { getProfile, getFootprints, updateProfile, type Footprint } from '../api/user'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()

const trips = ref<TripListItem[]>([])
const foot = ref<Footprint>({ city_count: 0, travel_days: 0, total_km: 0, progress: 0 })

onMounted(async () => {
  // 切到本页时回到顶部：SPA 导航不会重置 window.scrollY，
  // 从滚动过的页面（首页/行程）切过来会停在原滚动位置
  window.scrollTo(0, 0)
  // 先从 store 拿登录回写的 name 做首屏渲染，再异步刷新
  try {
    const p = await getProfile()
    userStore.setProfile(p)
  } catch { /* 未登录由路由守卫处理 */ }
  // 这两项各自兜底：任一失败都不该把它变成未处理的 rejection（会让后续代码整段不执行）
  try { trips.value = await getTrips() } catch { /* 保持空列表 */ }
  try { foot.value = await getFootprints() } catch { /* 保持默认足迹 */ }
})

/* ── 编辑资料：头像 + 昵称（弹窗内编辑，确认才提交） ── */
const editProfileOpen = ref(false)
const editName = ref('')
const editAvatar = ref('')
const editSaving = ref(false)

function onEditProfile() {
  // 预填当前值
  editName.value = userStore.profile?.name || ''
  editAvatar.value = ''
  editProfileOpen.value = true
}

function onPickAvatar() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片不能超过 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        editAvatar.value = await compressImage(reader.result as string, 400)
      } catch {
        showToast('图片处理失败')
      }
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

async function onSaveProfile() {
  const name = editName.value.trim()
  if (!name) return showToast('请输入昵称')

  editSaving.value = true
  try {
    // 有新头像就一起提交，没有只改名字
    const params: { name: string; avatar?: string } = { name }
    if (editAvatar.value) params.avatar = editAvatar.value
    const updated = await updateProfile(params)
    userStore.setProfile(updated)
    showToast('修改成功')
    editProfileOpen.value = false
  } catch {
    // 请求层 toast
  } finally {
    editSaving.value = false
  }
}

/** Canvas 压缩图片为 base64 */
function compressImage(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width
        width = maxSize
      } else if (height > maxSize) {
        width = (width * maxSize) / height
        height = maxSize
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

/* ── 通用设置二级菜单 ── */
const settingsOpen = ref(false)
function openSettings() {
  settingsOpen.value = true
}
function closeSettings() {
  settingsOpen.value = false
}

async function onLogout() {
  closeSettings()
  try {
    await showConfirmDialog({
      title: '退出登录',
      message: '确定要退出当前账号吗？',
      confirmButtonText: '退出',
      confirmButtonColor: '#ff6a2b',
      cancelButtonText: '取消',
    })
    userStore.logout()
    showToast('已退出登录')
    router.replace('/login')
  } catch {
    // 用户取消，不处理
  }
}

/** 主推行程：进行中 > 最近待出行，否则取第一条 */
const featured = computed(() => {
  if (!trips.value.length) return null
  const toCard = (t: TripListItem) => ({ id: t.id, title: t.title, dateRange: formatDateRange(t.start_date, t.end_date), people: travelerCount(t), ...deriveTripState(t) })
  const ongoing = trips.value.find((t) => deriveTripState(t).state === 'ongoing')
  const upcoming = trips.value
    .filter((t) => deriveTripState(t).state === 'upcoming')
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  const pick = ongoing ?? upcoming ?? trips.value[0]
  return pick ? toCard(pick) : null
})

// 行程封面图（本页唯一照片 · 压字加渐变遮罩）——运行时外链，待换静态资产（缺口 #5）
const tripImage =
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' +
  encodeURIComponent('上海外滩夜景 城市天际线 旅行摄影 暖光') +
  '&image_size=landscape_4_3'
</script>

<style scoped>
/* 与首页 / 对话页共用三层体系 */
.profile {
  /* 颜色与字体 token 统一在 src/styles/tokens.css（:root），此处不再声明 */

  min-height: 100vh;
  min-height: 100dvh;
  background: var(--c-bg);
  color: var(--c-text);
  padding-bottom: 72px; /* tabbar */
  font-family: var(--font-sans);
}

/* ---------- Hero ---------- */
.hero {
  background: linear-gradient(160deg, var(--c-brand-deep) 0%, var(--c-brand) 100%);
  padding: calc(env(safe-area-inset-top) + 24px) 20px 44px;
  border-radius: 0 0 24px 24px;
}
.hero__inner {
  display: flex;
  align-items: center;
  gap: 14px;
}
.hero__user { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
.hero__avatar {
  width: 54px; height: 54px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  display: grid; place-items: center;
  color: #fff;
}
.hero__avatar :deep(.van-icon) { font-size: 28px; }
.hero__avatar-img {
  width: 100%; height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.hero__info { min-width: 0; }
.hero__name {
  font-size: 19px; font-weight: 700;
  color: #fff; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hero__tags { display: flex; gap: 6px; margin-top: 6px; }
.hero__tag {
  font-size: 11px; font-weight: 600;
  color: #fff;
  background: rgba(255, 255, 255, 0.18);
  padding: 2px 8px;
  border-radius: 8px;
}
.hero__edit {
  width: 36px; height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  display: grid; place-items: center;
  color: #fff;
}
.hero__edit svg { width: 18px; height: 18px; }

/* ---------- 足迹卡（压在 hero 上） ---------- */
.tracks {
  margin: -28px 20px 0;
  position: relative;
  background: var(--c-card);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 6px 20px rgba(10, 26, 43, 0.08);
}
.tracks__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.tracks__title { font-size: 15px; font-weight: 700; }
.tracks__stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stat__num { font-size: 24px; font-weight: 800; color: var(--c-brand); line-height: 1; letter-spacing: -0.02em; }
.stat__label { font-size: 11px; color: var(--c-sub); }
.stat__sep { width: 1px; height: 28px; background: var(--c-divider); }
.tracks__progress { display: flex; gap: 6px; justify-content: center; margin-top: 14px; }
.tracks__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--c-divider);
}
.tracks__dot.is-on { background: var(--c-brand); }

/* ---------- 通用 block ---------- */
.block { margin: 20px 20px 0; }
.block__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.block__title { font-size: 15px; font-weight: 700; }
.block__more {
  display: inline-flex; align-items: center; gap: 2px;
  font-size: 12px; color: var(--c-sub);
}
.block__more :deep(.van-icon) { font-size: 12px; }

/* ---------- 行程卡（AI 状态展示） ---------- */
.trip {
  display: flex;
  gap: 12px;
  align-items: stretch;
  background: var(--c-card);
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(10, 26, 43, 0.05);
}
.trip__body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.trip__route { font-size: 16px; font-weight: 700; color: var(--c-text); }
.trip__meta { font-size: 12px; color: var(--c-sub); margin-top: 4px; }
.trip__ai {
  margin-top: auto;
  display: inline-flex; align-items: center; gap: 3px;
  align-self: flex-start;
  font-size: 11px; font-weight: 600;
  color: var(--c-brand-deep);
  background: var(--c-brand-soft);
  padding: 3px 8px;
  border-radius: 6px;
}
.trip__ai :deep(.van-icon) { font-size: 12px; }
.trip__media {
  position: relative;
  width: 96px; flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: var(--c-divider);
}
.trip__img { width: 100%; height: 100%; object-fit: cover; display: block; }
.trip__overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(10, 74, 138, 0.55) 100%);
}
.trip__badge {
  position: absolute; top: 6px; left: 6px;
  font-size: 10px; font-weight: 700;
  color: #fff;
  background: var(--c-brand);
  padding: 2px 6px;
  border-radius: 4px;
}

/* ---------- 设置列表 ---------- */
.settings { margin: 20px 20px 0; }
.settings :deep(.van-cell-group--inset) {
  margin: 0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(10, 26, 43, 0.05);
}
.settings :deep(.van-cell) {
  padding: 14px 16px;
  font-size: 14px;
}
.settings :deep(.van-cell__title) { color: var(--c-text); font-weight: 500; }
.settings :deep(.van-cell__left-icon) {
  font-size: 20px;
  color: var(--c-sub);
  margin-right: 12px;
}
.settings :deep(.van-cell__right-icon) { color: var(--c-divider); }
.settings :deep(.van-cell::after) { border-color: var(--c-divider); }

/* ── 通用设置二级菜单面板 ── */
.settings-panel {
  padding: 16px 16px calc(env(safe-area-inset-bottom, 0px) + 16px);
}
.settings-panel__title {
  margin: 0 0 12px 4px;
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text);
}
.settings-panel :deep(.van-cell-group) {
  border-radius: 12px;
  overflow: hidden;
}
.settings-panel :deep(.van-cell) {
  padding: 14px 16px;
  font-size: 14px;
}
.settings-panel :deep(.van-cell__left-icon) {
  font-size: 20px;
  margin-right: 12px;
}
/* 退出登录：红色危险操作 */
.logout-cell :deep(.van-cell__title) { color: #ff3b30; font-weight: 500; }
.logout-cell :deep(.van-cell__left-icon) { color: #ff3b30; }
.logout-cell :deep(.van-cell__right-icon) { color: var(--c-divider); }
.settings-panel__tip {
  margin-top: 12px;
  text-align: center;
  font-size: 11.5px;
  color: var(--c-muted);
}

/* ── 编辑资料面板 ── */
.edit-panel {
  padding: 16px 20px calc(env(safe-area-inset-bottom, 0px) + 20px);
}
.edit-panel__title {
  margin: 0 0 20px 4px;
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text);
}
.edit-panel__avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  cursor: pointer;
}
.edit-panel__avatar {
  width: 80px; height: 80px;
  border-radius: 50%;
  border: 2px solid var(--c-divider);
  display: grid; place-items: center;
  overflow: hidden;
  background: var(--c-bg);
}
.edit-panel__avatar-img {
  width: 100%; height: 100%;
  object-fit: cover;
}
.edit-panel__avatar :deep(.van-icon) { font-size: 32px; color: var(--c-muted); }
.edit-panel__avatar-hint {
  font-size: 12px;
  color: var(--c-sub);
}
.edit-panel__field {
  margin-bottom: 24px;
}
.edit-panel__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-sub);
  margin-bottom: 8px;
}
.edit-panel__input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border: 1px solid var(--c-divider);
  border-radius: 10px;
  background: var(--c-card);
  font-size: 15px;
  color: var(--c-text);
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}
.edit-panel__input:focus { border-color: var(--c-brand); }
.edit-panel__save {
  width: 100%;
  height: 46px;
  border: none;
  border-radius: 23px;
  background: var(--c-brand);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(14, 124, 134, 0.3);
}
.edit-panel__save:disabled { opacity: 0.7; }
</style>
