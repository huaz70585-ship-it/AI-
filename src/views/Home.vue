<template>
  <div class="home">
    <!-- ① 状态栏 + 城市定位 -->
    <header class="topbar">
      <button class="city" @click="onCity">
        <van-icon name="location-o" class="city__ic" />
        <span class="city__name">{{ city }}</span>
        <van-icon name="arrow-down" class="city__arrow" />
      </button>
      <button class="msg-btn" aria-label="消息" @click="onMessage">
        <van-icon name="chat-o" />
        <span class="msg-btn__dot"></span>
      </button>
    </header>

    <main class="body">
      <!-- ② 搜索框（需求式占位） -->
      <div class="search">
        <van-icon name="search" class="search__ic" />
        <input
          v-model="need"
          class="search__field"
          placeholder="说出你想去哪儿"
          @keyup.enter="onSend"
        />
        <button class="search__send" @click="onSend" aria-label="生成">
          <van-icon name="arrow" />
        </button>
      </div>

      <!-- ③ 快捷需求芯片（3 个） -->
      <div class="chips">
        <button
          v-for="c in needChips"
          :key="c"
          class="chip"
          @click="need = c"
        >{{ c }}</button>
      </div>

      <!-- ④ 金刚区（一行 5 个 · 白底线性图标 · 无彩色块） -->
      <nav class="quick">
        <button
          v-for="q in quickEntries"
          :key="q.label"
          class="quick__item"
          @click="onQuick(q)"
        >
          <span class="quick__ic" v-html="q.icon"></span>
          <span class="quick__label">{{ q.label }}</span>
        </button>
      </nav>

      <!-- ⑤ AI 行程规划入口卡（全页唯一视觉重心） -->
      <section class="ai-card" @click="onAiPlan">
        <div class="ai-card__icon">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" fill="currentColor"/>
          </svg>
        </div>
        <div class="ai-card__body">
          <p class="ai-card__title">说出你的假期，帮你排好行程</p>
          <p class="ai-card__sub">AI 8 秒生成 · 可拖拽改天数、替换景点</p>
        </div>
        <span class="ai-card__arrow"><van-icon name="arrow" /></span>
      </section>

      <!-- ⑥ 内容流 -->
      <section class="stream">
        <header class="stream__head">
          <h3 class="stream__title">为你推荐</h3>
          <button class="stream__more">全部</button>
        </header>

        <!-- 主视觉大图（16:9 · 首屏唯一图片） -->
        <article class="feature" @click="onFeature">
          <img :src="featureImage" alt="" class="feature__img" />
          <div class="feature__tint"></div>
          <div class="feature__mask"></div>
          <div class="feature__text">
            <span class="feature__tag">主视觉</span>
            <p class="feature__name">圣托里尼 · 蓝白爱琴海</p>
          </div>
        </article>

        <!-- 双列等宽卡片（4:3 色块占位） -->
        <div class="grid">
          <article
            v-for="c in streamCards"
            :key="c.id"
            class="card"
            @click="onCard(c)"
          >
            <div class="card__media">
              <van-icon :name="c.icon" class="card__media-ic" />
            </div>
            <div class="card__body">
              <p class="card__name">{{ c.name }}</p>
              <p class="card__meta">{{ c.meta }}</p>
              <p class="card__price">
                <span class="card__price-num">{{ c.price }}</span>
                <span class="card__price-unit">起</span>
              </p>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'

const router = useRouter()

/* ① 城市 */
const city = ref('北京')
function onCity() {
  showToast({ message: '切换城市 · 占位', position: 'top' })
}
function onMessage() {
  router.push('/message')
}

/* ② 需求输入 */
const need = ref('')
const needChips = ['周末周边游', '五一 3 天', '亲子出游']

function onSend() {
  if (!need.value.trim()) {
    showToast({ message: '说说你想去哪儿、玩几天', position: 'top' })
    return
  }
  // 轻介入：带需求进入 AI 规划
  router.push({ path: '/chat', query: { q: need.value } })
}

/* ④ 金刚区（5 个 · 线性图标） */
const quickEntries = [
  {
    label: '周边游',
    icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5c2.9 0 5.3 2.3 5.3 5.2 0 3.4-4.2 8.6-5.3 9.8-1.1-1.2-5.3-6.4-5.3-9.8 0-2.9 2.4-5.2 5.3-5.2Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="7.6" r="1.7" fill="currentColor"/></svg>`,
  },
  {
    label: '机票',
    icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M2 14l9-2-1-7 3-1 3 8 7-2 1 2-7 3 1 5-2 1-4-3-3 5-2 0-3-5-7-3 0-1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  },
  {
    label: '酒店',
    icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 21V8l9-5 9 5v13" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 21v-6h6v6M9 11h.01M15 11h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  },
  {
    label: '攻略',
    icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 4h10a3 3 0 0 1 3 3v13l-3-2-3 2-3-2-3 2-3-2V4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 9h6M8 13h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  },
  {
    label: '签证',
    icon: `<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M9 9h6M9 13h6M9 17h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  },
]

function onQuick(q: { label: string }) {
  showToast({ message: `${q.label} · 占位入口`, position: 'top' })
}

/* ⑤ AI 行程规划入口 */
function onAiPlan() {
  router.push('/chat')
}

/* ⑥ 主视觉图（首屏唯一图片 · 统一 5% 品牌色温） */
const featureImage =
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' +
  encodeURIComponent('希腊圣托里尼 蓝顶教堂 爱琴海 日落 旅行摄影 暖光') +
  '&image_size=landscape_16_9'

function onFeature() {
  showToast({ message: '主视觉 · 占位', position: 'top' })
}

/* ⑥ 内容流卡片（4:3 色块占位） */
const streamCards = [
  { id: 'c1', name: '京都五日禅意漫游', meta: '5 天 · 文化沉浸', price: '¥6800', icon: 'photo-o' },
  { id: 'c2', name: '大理风物漫游', meta: '4 天 · 国内短途', price: '¥3200', icon: 'photo-o' },
  { id: 'c3', name: '巴厘岛海岛逃离', meta: '7 天 · 海岛度假', price: '¥9200', icon: 'photo-o' },
  { id: 'c4', name: '冰岛极光追猎', meta: '6 天 · 极致自然', price: '¥14800', icon: 'photo-o' },
]

function onCard(c: { name: string }) {
  showToast({ message: `「${c.name}」· 占位卡片`, position: 'top' })
}
</script>

<style scoped>
/* ============================================================
   严格三层配色 80 / 15 / 5
   基础层 80% · 品牌层 15% · 强调层 5%
   ============================================================ */
.home {
  /* 基础层 */
  --c-bg: #f6f7f9;          /* 页面底（非纯白，避免白卡浮脏） */
  --c-card: #ffffff;         /* 卡片 */
  --c-divider: #edeff2;      /* 分割线 */
  --c-text: #1a1d21;         /* 主文字 */
  --c-sub: #6b7280;          /* 次文字 */
  /* 品牌层（三档明度） */
  --c-brand-light: #4da3f5;  /* 亮：浅填充、选中底 */
  --c-brand: #0f7be0;        /* 中：按钮、图标、主强调 */
  --c-brand-deep: #0a4a8a;   /* 深：压浅底的文字、高对比图标 */
  --c-chip-bg: #e6f1fb;      /* 浅蓝芯片底 */
  /* 强调层 */
  --c-accent: #ff6a2b;       /* 暖橙：价格/限时/抢购，绝不做背景 */

  min-height: 100vh;
  min-height: 100dvh;
  background: var(--c-bg);
  color: var(--c-text);
  padding-bottom: 72px; /* tabbar 高度 + 缓冲 */
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* ---------- ① 状态栏 + 城市定位 ---------- */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 12px) 16px 10px;
  background: var(--c-bg);
  position: sticky;
  top: 0;
  z-index: 10;
}
.city {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--c-text);
}
.city__ic { font-size: 17px !important; color: var(--c-brand); }
.city__name { font-size: 17px; font-weight: 700; }
.city__arrow { font-size: 12px !important; color: var(--c-sub); }
.msg-btn {
  width: 38px; height: 38px;
  border-radius: 50%;
  display: grid; place-items: center;
  color: var(--c-text);
  position: relative;
}
.msg-btn :deep(.van-icon) { font-size: 22px; }
.msg-btn__dot {
  position: absolute; top: 7px; right: 8px;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--c-accent);
  border: 2px solid var(--c-bg);
}

.body { padding: 0 16px; }

/* ---------- ② 搜索框（胶囊 · 白底 + 主色描边） ---------- */
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 6px 0 14px;
  border-radius: 22px;
  background: var(--c-card);
  border: 1px solid var(--c-brand);
  box-shadow: 0 2px 8px rgba(15, 123, 224, 0.08);
}
.search__ic { color: var(--c-brand); font-size: 18px !important; flex-shrink: 0; }
.search__field {
  flex: 1; min-width: 0;
  font-size: 14px; font-weight: 500;
  color: var(--c-text);
  background: transparent; border: none; outline: none;
}
.search__field::placeholder { color: var(--c-sub); font-weight: 400; }
.search__send {
  width: 34px; height: 34px;
  border-radius: 50%;
  background: var(--c-brand);
  color: #fff;
  display: grid; place-items: center;
  flex-shrink: 0;
  transition: transform 0.15s;
}
.search__send:active { transform: scale(0.92); }
.search__send :deep(.van-icon) { font-size: 16px; font-weight: 700; }

/* ---------- ③ 快捷需求芯片（3 · 浅蓝底 + 主色文字） ---------- */
.chips { display: flex; gap: 8px; margin-top: 10px; }
.chip {
  padding: 6px 14px;
  font-size: 12.5px; font-weight: 600;
  color: var(--c-brand-deep);       /* 深：压浅底的文字 */
  background: var(--c-chip-bg);
  border-radius: 16px;
  transition: transform 0.15s;
}
.chip:active { transform: scale(0.95); }

/* ---------- ④ 金刚区（白底线性 · 无彩色块） ---------- */
.quick {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin-top: 18px;
  padding: 12px 8px;
  background: var(--c-card);
  border-radius: 12px;
}
.quick__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  color: var(--c-sub);
  transition: color 0.15s;
}
.quick__item:active { color: var(--c-brand); }
.quick__ic {
  width: 28px; height: 28px;
  display: grid; place-items: center;
  color: var(--c-text);
}
.quick__item:active .quick__ic { color: var(--c-brand); }
.quick__ic :deep(svg) { width: 22px; height: 22px; }
.quick__label { font-size: 11.5px; font-weight: 500; }

/* ---------- ⑤ AI 行程规划入口卡（唯一视觉重心） ---------- */
.ai-card {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 8px;                 /* 圆角 8px */
  background: var(--c-chip-bg);        /* 浅蓝底 */
  border: 1px solid var(--c-brand);   /* 主色描边 */
  cursor: pointer;
  transition: transform 0.15s;
}
.ai-card:active { transform: scale(0.99); }
.ai-card__icon {
  width: 40px; height: 40px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--c-brand);
  color: #fff;
  display: grid; place-items: center;
}
.ai-card__icon svg { width: 22px; height: 22px; }
.ai-card__body { flex: 1; min-width: 0; }
.ai-card__title { font-size: 15px; font-weight: 700; color: var(--c-brand-deep); letter-spacing: -0.01em; }
.ai-card__sub { font-size: 11.5px; color: var(--c-sub); margin-top: 2px; }
.ai-card__arrow {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--c-card);
  color: var(--c-brand);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.ai-card__arrow :deep(.van-icon) { font-size: 13px; font-weight: 700; }

/* ---------- ⑥ 内容流 ---------- */
.stream { margin-top: 18px; }
.stream__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.stream__title { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
.stream__more { font-size: 12.5px; color: var(--c-brand); font-weight: 600; }

/* 主视觉大图 16:9 · 首屏唯一图片 */
.feature {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background: var(--c-divider);
  cursor: pointer;
}
.feature__img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* 5% 品牌色统一色温 */
.feature__tint {
  position: absolute; inset: 0;
  background: rgba(15, 123, 224, 0.05);
  pointer-events: none;
}
/* 底部渐变遮罩 透明 → 黑 60% */
.feature__mask {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 45%, rgba(0, 0, 0, 0.6) 100%);
  pointer-events: none;
}
.feature__text {
  position: absolute;
  left: 12px; bottom: 12px;
  z-index: 1;
}
.feature__tag {
  display: inline-block;
  font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
  color: #fff;
  background: var(--c-brand);
  padding: 2px 6px;
  border-radius: 4px;
}
.feature__name {
  margin-top: 6px;
  font-size: 16px; font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

/* 双列等宽卡片 · 圆角 12 · 图片 4:3 色块占位 */
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}
.card {
  background: var(--c-card);
  border-radius: 12px;
  padding: 8px;            /* 内边距 8 → 图片圆角 = 12 − 8 = 4 */
  cursor: pointer;
  transition: transform 0.15s;
}
.card:active { transform: translateY(1px); }
.card__media {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 4px;     /* 容器 12 − 内边距 8 */
  background: linear-gradient(135deg, #edeff2 0%, #f6f7f9 100%);
  display: grid; place-items: center;
  position: relative;
}
.card__media::after {
  /* 5% 品牌色统一色温 */
  content: '';
  position: absolute; inset: 0;
  background: rgba(15, 123, 224, 0.05);
  border-radius: 4px;
}
.card__media-ic {
  font-size: 26px !important;
  color: var(--c-divider);
  position: relative;
  z-index: 1;
}
.card__body { padding: 8px 4px 4px; }
.card__name {
  font-size: 13.5px; font-weight: 600;
  color: var(--c-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.card__meta { font-size: 11px; color: var(--c-sub); margin-top: 2px; }
.card__price { margin-top: 6px; }
.card__price-num { font-size: 15px; font-weight: 800; color: var(--c-accent); } /* 暖橙：价格 */
.card__price-unit { font-size: 11px; color: var(--c-sub); margin-left: 1px; }
</style>
