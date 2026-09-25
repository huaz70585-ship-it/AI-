<template>
  <div class="home">
    <!-- ① 状态栏 + 品牌（城市切换功能已下线，首页聚合 4 城内容） -->
    <header class="topbar">
      <div class="topbar__left">
        <img class="brand-logo" src="/logo.svg" alt="途灵" />
        <span class="brand">途灵</span>
      </div>
    </header>

    <main class="body">
      <!-- ② AI 入口 = 搜索框形态（大厂工具语言：携程问道/飞猪 AI 都是搜索框，不发光不渐变不解释）。
           示例问句藏进 placeholder 轮播——界面不教用户，教学发生在输入框里 -->
      <section class="search" @click="focusNeed">
        <span class="search__spark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3l1.9 5.6a1 1 0 0 0 .63.63L20.2 11l-5.67 1.77a1 1 0 0 0-.63.63L12 19l-1.9-5.6a1 1 0 0 0-.63-.63L3.8 11l5.67-1.77a1 1 0 0 0 .63-.63L12 3Z" fill="currentColor"/>
          </svg>
        </span>
        <div class="search__wrap">
          <input
            ref="needInput"
            v-model="need"
            class="search__field"
            @keyup.enter="onSend"
          />
          <span v-if="!need" :key="phIndex" class="search__ph">{{ phs[phIndex] }}</span>
        </div>
        <button class="search__btn" aria-label="生成行程" @click.stop="onSend">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </section>

      <!-- ⑥ 内容流 -->
      <section class="stream">
        <header class="stream__head">
          <h3 class="stream__title">为你推荐</h3>
        </header>

        <!-- 主视觉骨架 -->
        <div v-if="loading" class="feature-skeleton">
          <van-skeleton-image image-size="100%" class="feature-skeleton__img" />
        </div>
        <!-- 主视觉轮播（16:9 · 每个城市一张名片图 · 图片来自 cities.hero_image） -->
        <div v-else class="feature rise">
          <van-swipe :autoplay="4000" lazy-render :show-indicators="true" class="feature__swipe" @change="onSwipeChange">
            <van-swipe-item v-for="c in cities" :key="c.id">
              <img v-lazy="c.hero_image" alt="" class="feature__img" />
            </van-swipe-item>
          </van-swipe>
          <div class="feature__tint"></div>
          <div class="feature__mask"></div>
          <div class="feature__text">
            <span class="feature__tag">{{ currentSlide?.name }}</span>
            <p class="feature__name">{{ currentSlide?.tagline }}</p>
          </div>
        </div>

        <!-- 景点卡片骨架（与 rail 同形，避免加载完成时形状跳变） -->
        <div v-if="loading" class="rail">
          <div v-for="i in 2" :key="i" class="pcard">
            <van-skeleton-image image-size="100%" class="pcard__skeleton-media" />
            <div class="pcard__body">
              <span class="skel skel-name"></span>
              <div class="pcard__foot">
                <span class="skel skel-price"></span>
              </div>
            </div>
          </div>
        </div>
        <!-- 横滑大卡（图主导 + 两行字 · snap 对齐 · 露出半张卡暗示可滑） -->
        <div v-else class="rail">
          <article
            v-for="(c, i) in streamCards"
            :key="c.id"
            class="pcard rise"
            :style="{ animationDelay: `${120 + i * 70}ms` }"
          >
            <div class="pcard__media">
              <img v-if="c.image" v-lazy="c.image" alt="" class="pcard__media-img" />
              <van-icon v-else name="photo-o" class="pcard__media-ic" />
            </div>
            <div class="pcard__body">
              <p class="pcard__name">{{ c.name }}</p>
              <div class="pcard__foot">
                <p class="pcard__price">
                  <span v-if="c.price === '免费'" class="pcard__price-num">免费</span>
                  <template v-else>
                    <span class="pcard__price-sym">¥</span>
                    <span class="pcard__price-num">{{ c.price.replace('¥','') }}</span>
                    <span class="pcard__price-unit">人均</span>
                  </template>
                </p>
                <span v-if="c.rating" class="pcard__rating">
                  <van-icon name="star" class="pcard__rating-ic" />
                  {{ c.rating }}
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getCities, getCitySpots, type City, type CitySpot } from '../api/city'

const router = useRouter()

/* ① 城市名片（轮播直接用 cities.hero_image + tagline，切换城市功能已下线） */
const cities = ref<City[]>([])
const slideIndex = ref(0)
const currentSlide = computed(() => cities.value[slideIndex.value])
function onSwipeChange(idx: number) { slideIndex.value = idx }

/* ⑥ 景点卡片：每个城市取 1 个招牌景点 */
const loading = ref(true)
const streamCards = ref<CitySpot[]>([])

async function loadHome() {
  loading.value = true
  try {
    const [cityRows, spotRows] = await Promise.all([getCities(), getCitySpots()])
    cities.value = cityRows
    // 每城市只取 sort 最小的 1 条（后端按 city_id, sort 返回，取每个 city_id 的首次出现）
    const seen = new Set<string>()
    streamCards.value = spotRows.filter((s) => {
      if (seen.has(s.city_id)) return false
      seen.add(s.city_id)
      return true
    })
  } catch {
    cities.value = []
    streamCards.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadHome)

/* ② 需求输入：hero 整卡点击只聚焦输入框，不再直接跳转 */
const need = ref('')
const needInput = ref<HTMLInputElement | null>(null)

function focusNeed() {
  needInput.value?.focus()
}

function onSend() {
  if (!need.value.trim()) {
    showToast({ message: '说说你想去哪儿、玩几天', position: 'top' })
    return
  }
  // 轻介入：带需求进入 AI 规划
  router.push({ path: '/chat', query: { q: need.value } })
}

/* ③ 示例问句不再占一层 UI：藏进 placeholder 轮播（3.2s 一换，fade 过渡） */
const phs = [
  '国庆去成都三天，帮我排个行程',
  '预算 1000 块，三天怎么玩',
  '上海 citywalk，来一条一日路线',
  '带娃出行，节奏别太赶',
]
const phIndex = ref(0)
const phTimer = window.setInterval(() => {
  phIndex.value = (phIndex.value + 1) % phs.length
}, 3200)
onUnmounted(() => clearInterval(phTimer))
</script>

<style scoped>
/* ============================================================
   严格三层配色 80 / 15 / 5
   基础层 80% · 品牌层 15% · 强调层 5%
   ============================================================ */
.home {
  /* 颜色与字体 token 统一在 src/styles/tokens.css（:root），此处不再声明 */

  min-height: 100vh;
  min-height: 100dvh;
  background: var(--c-bg);
  color: var(--c-text);
  padding-bottom: 72px; /* tabbar 高度 + 缓冲 */
  font-family: var(--font-sans);
}

/* ---------- ① 状态栏 + 品牌 ---------- */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 8px) 20px 4px;
  background: var(--c-bg);
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand {
  font-size: 17px;
  font-weight: 800;
  color: var(--c-brand-deep);
  letter-spacing: 0.04em;
}
.topbar__left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.brand-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
/* 页边 20px（原 16px）：宏观留白是"贵"的最便宜来源（msg-btn 样式已随入口挪 tabbar 删除） */
.body { padding: 0 20px; }

/* ---------- ② AI 入口 = 搜索框（描边打底 + 灵光呼吸 · 与 tabbar AI 圆钮同源） ---------- */
.search {
  position: relative;        /* 灵光伪元素的定位父级 */
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 6px 0 15px;
  background: var(--c-card);
  border: 1px solid var(--c-divider);
  border-radius: var(--radius-pill);
  transition: border-color 0.2s var(--ease-motion);
}
/* 焦点态：描边品牌青（原本动作）+ 光晕定格最亮 —— 打字时不让余光跳动抢注意力 */
.search:focus-within { border-color: var(--c-brand); }
/* 灵光：与 tabbar AI 圆钮同一套口径（tokens 的 --glow-halo-bar + 全局 glow-breathe）。
   ① 长条面积远大于 46px 圆钮 → 用更窄的扩散 + 更低的浓度（22px / 0.30 vs 18px / 0.45），
      否则整根条会像一根发光灯管；
   ② 外发光按规范只画在 border-box 之外，被白卡自身裁掉内侧部分，
      所以不需要负 z-index，卡面也不会被青光染脏；
   ③ 只动 opacity，不动 box-shadow（GPU 安全）。 */
.search::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: var(--glow-halo-bar);
  animation: glow-breathe 3.4s var(--ease-motion) infinite; /* 动效本体在 tokens.css */
  pointer-events: none;
}
.search:focus-within::after {
  animation-play-state: paused;
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .search::after { animation: none; opacity: 0.7; }
}
.search__spark {
  flex-shrink: 0;
  display: flex;
  color: var(--c-brand);
}
.search__spark svg { width: 17px; height: 17px; }
.search__wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
}
.search__field {
  width: 100%;
  height: 100%;
  font-size: 14.5px;
  font-weight: 500;
  color: var(--c-text);
  background: transparent;
  border: none;
  outline: none;
}
/* placeholder 轮播：真 input 的 placeholder 换字无法过渡，叠一层 span 做 fade */
.search__ph {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  font-size: 14.5px;
  color: var(--c-sub);
  pointer-events: none;
  animation: ph-fade 0.5s var(--ease-motion);
}
@keyframes ph-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.search__btn {
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: var(--c-brand-deep);
  display: grid;
  place-items: center;
  color: #fff;
  /* 与 tabbar AI 圆钮同一份光源（下投影 + 近距青光）。此处刻意「不呼吸」：
     一行里只允许一个会动的元素 —— 条体已在呼吸，按钮静止，避免双动互相打架 */
  box-shadow: var(--glow-btn);
  transition: transform 0.15s var(--ease-motion);
}
.search__btn:active { transform: scale(0.94); }
.search__btn svg { width: 18px; height: 18px; }

/* ---------- ④ 内容流 ---------- */
.stream { margin-top: 26px; }
.stream__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.stream__title { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
.stream__more { font-size: 12.5px; color: var(--c-brand); font-weight: 600; }

/* 主视觉大图 16:9 · 首屏唯一图片 */
.feature {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-panel);
  overflow: hidden;
  background: var(--c-divider);
  cursor: pointer;
  box-shadow: var(--shadow-card);
}
.feature__img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  /* 影像层统一调色：微降饱和 + 提对比，杂图立刻归成「一套」的编辑感 */
  filter: saturate(0.94) contrast(1.05);
}
.feature__swipe {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-panel);
  overflow: hidden;
}
.feature__swipe :deep(.van-swipe__indicators) { bottom: 16px; }
.feature__swipe :deep(.van-swipe__indicator) {
  width: 6px; height: 6px;
  background: rgba(255,255,255,0.45);
}
.feature__swipe :deep(.van-swipe__indicator--active) { background: #fff; }
/* 5% 品牌色统一色温（青调渐层，替代单色平铺） */
.feature__tint {
  position: absolute; inset: 0;
  background: linear-gradient(165deg, rgba(20, 184, 196, 0.10) 0%, rgba(9, 94, 102, 0.04) 45%, rgba(9, 94, 102, 0.10) 100%);
  pointer-events: none;
}
/* 底部渐隐：黑渐变换成深青 scrim —— 文字可读性不变，但和品牌是一个色系 */
.feature__mask {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(9, 94, 102, 0) 42%, rgba(7, 56, 61, 0.78) 100%);
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

/* 横滑大卡 · 图主导 + 两行字 · 卡宽 62%（露出下一张的一半，暗示可滑） */
.rail {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  margin-right: -20px;          /* 破出页边，卡片滑到屏幕边缘 */
  padding-right: 20px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.rail::-webkit-scrollbar { display: none; }
.pcard {
  flex: 0 0 62%;
  scroll-snap-align: start;
  background: var(--c-card);
  /* 描边优先、阴影退场：密度偏低的界面靠边界与留白分层，不靠投影堆叠 */
  border: 1px solid var(--c-divider);
  border-radius: var(--radius-card);
  overflow: hidden;
}

/* ---------- 进入动效：fade-up 逐个浮起（数据到位后渲染，动画自然触发） ---------- */
.rise {
  animation: rise-in 0.55s var(--ease-motion) backwards;
}
@keyframes rise-in {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .rise { animation: none; }
}
.pcard__media {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, var(--c-divider) 0%, var(--c-bg) 100%);
  display: grid; place-items: center;
  overflow: hidden;
}
.pcard__media-ic {
  font-size: 26px !important;
  color: var(--c-divider);
}
.pcard__media-img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  filter: saturate(0.96) contrast(1.04); /* 与主视觉同一套调色 */
}
.pcard__body { padding: 10px 12px 12px; }
.pcard__name {
  font-size: 14.5px; font-weight: 600;
  color: var(--c-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pcard__foot {
  margin-top: 7px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}
.pcard__price { display: flex; align-items: baseline; font-variant-numeric: tabular-nums; }
.pcard__price-sym {
  font-size: 11px; font-weight: 700;
  color: var(--c-money);
}
.pcard__price-num {
  font-size: 16px; font-weight: 700;
  color: var(--c-money);
  line-height: 1;
}
.pcard__price-unit {
  font-size: 10.5px;
  color: var(--c-sub);
  margin-left: 2px;
}
.pcard__rating {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11.5px; font-weight: 500;
  color: var(--c-sub);
  font-variant-numeric: tabular-nums;
}
.pcard__rating-ic {
  font-size: 11.5px !important;
  color: var(--c-accent);
}
/* 骨架占位 */
.skel-name { width: 62%; height: 13px; border-radius: 3px; }
.skel-price { width: 56px; height: 16px; border-radius: 3px; margin-top: 7px; }

/* ---------- 骨架屏 ---------- */
@keyframes skel-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skel {
  position: relative;
  overflow: hidden;
  background: var(--c-divider);
}
.skel::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.55) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: skel-shimmer 1.4s ease-in-out infinite;
}

.feature-skeleton {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
}
.feature-skeleton :deep(.van-skeleton-image) {
  width: 100% !important;
  height: 100% !important;
  padding: 0 !important;
}

.pcard__skeleton-media {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 4px;
}
.pcard__skeleton-media :deep(.van-skeleton-image) {
  width: 100% !important;
  height: 100% !important;
  padding: 0 !important;
}
.pcard :deep(.van-skeleton) { padding: 0; }
.pcard :deep(.van-skeleton__row) {
  height: 12px;
  margin-top: 8px;
  border-radius: 4px;
  background: var(--c-divider);
}
.pcard :deep(.van-skeleton__row):first-child { margin-top: 4px; }
</style>
