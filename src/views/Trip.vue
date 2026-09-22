<template>
  <div class="trip-page">
    <!-- 顶栏：标题 + 副信息行 -->
    <van-nav-bar left-arrow fixed placeholder @click-left="onBack">
      <template #title>
        <div class="nav-title">
          <span class="nav-title__main">上海 · 4日</span>
          <span class="nav-title__sub">
            <span>10.12 - 10.15</span>
            <span class="dot">·</span>
            <span>2人</span>
            <span class="dot">·</span>
            <span class="nav-title__budget">¥3,860</span>
          </span>
        </div>
      </template>
      <template #right>
        <van-icon name="ellipsis" size="20" />
      </template>
    </van-nav-bar>

    <!-- Tab 切换：行程 / 地图 -->
    <div class="seg">
      <button class="seg__btn is-active">行程</button>
      <button class="seg__btn">
        <van-icon name="location-o" /> 地图
      </button>
    </div>

    <!-- 日期芯片 -->
    <div class="days">
      <button
        v-for="d in 4"
        :key="d"
        class="day"
        :class="{ 'is-active': d === activeDay }"
        @click="activeDay = d"
      >D{{ d }}</button>
    </div>

    <!-- 当日头部：日期 / 天气 / 预算 -->
    <div class="dayhead">
      <span class="dayhead__d">D{{ activeDay }}</span>
      <span class="dayhead__date">10.{{ 11 + activeDay }} 周{{ ['六', '日', '一', '二'][activeDay - 1] }}</span>
      <span class="dayhead__weather"><van-icon name="sunny-o" /> 晴 22°</span>
      <span class="dayhead__budget">当日 <em>¥980</em></span>
    </div>

    <!-- 时间轴 -->
    <div class="timeline">
      <div v-for="(it, i) in items" :key="i" class="tl">
        <div class="tl__rail">
          <span class="tl__dot" :class="it.state"></span>
          <span v-if="i < items.length - 1" class="tl__line"></span>
        </div>
        <div class="tl__time">{{ it.time }}</div>
        <div class="tl__card">
          <div class="tl__body">
            <p class="tl__title">{{ it.title }}</p>
            <p class="tl__tags">{{ it.tags }}</p>
          </div>
          <div class="tl__media" :class="{ 'is-img': it.img }">
            <img v-if="it.img" :src="it.img" alt="" />
            <van-icon v-else name="photo-o" class="tl__media-ic" />
          </div>
          <van-icon v-if="it.booked" name="checked" class="tl__check" />
        </div>
      </div>
    </div>

    <!-- AI 总结条 -->
    <div class="ai-sum">
      <span class="ai-sum__ic">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" fill="currentColor"/>
        </svg>
      </span>
      <p>今日步行约 6.2km，下午豫园人会高峰，可把城隍庙挪到明天上午</p>
    </div>

    <!-- 次日预告 -->
    <div class="dayhead dayhead--next">
      <span class="dayhead__d">D2</span>
      <span class="dayhead__date">10.13 周日</span>
      <span class="dayhead__weather"><van-icon name="cloudy-o" /> 多云 20°</span>
      <span class="dayhead__budget">当日 <em>¥1,240</em></span>
    </div>
    <p class="next-hint">D2 - D4 共 11 项安排，继续下滑查看</p>

    <!-- AI 待确认卡 -->
    <div class="pending">
      <span class="pending__ic"><van-icon name="clock-o" /></span>
      <div class="pending__body">
        <p class="pending__title">3 项安排待你确认</p>
        <p class="pending__sub">AI 时间/地点可能不准，已标出待核对项</p>
      </div>
      <button class="pending__btn">去确认</button>
    </div>

    <!-- 底部留白 -->
    <div class="foot-space"></div>

    <!-- FAB -->
    <button class="fab" aria-label="新增安排">
      <van-icon name="plus" />
    </button>

    <!-- 底部操作栏（贴 tabbar 上方） -->
    <footer class="actionbar">
      <div class="actionbar__left">
        <span class="actionbar__label">总预算</span>
        <span class="actionbar__amount">¥3,860</span>
        <span class="actionbar__sub">6 项可预订</span>
      </div>
      <button class="actionbar__btn">一键预订全部</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeDay = ref(1)

interface TlItem {
  time: string
  title: string
  tags: string
  state: 'now' | 'past' | 'next'
  booked?: boolean
  img?: string
}

const items = ref<TlItem[]>([
  {
    time: '09:00',
    title: '抵达虹桥 · 酒店寄存',
    tags: '交通 · 约50分钟 · 行李先寄存',
    state: 'past',
  },
  {
    time: '10:30',
    title: '外滩观景平台',
    tags: '观景 · 建议30分钟 · 门票¥0',
    state: 'now',
    img: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' +
      encodeURIComponent('上海外滩观景平台 城市天际线 旅行') +
      '&image_size=landscape_4_3',
  },
  {
    time: '12:30',
    title: '午餐 · 老弄堂本帮菜',
    tags: '餐饮 · 建议60分钟 · 已预订',
    state: 'next',
    booked: true,
  },
])

function onBack() {
  router.push('/')
}
</script>

<style scoped>
.trip-page {
  --c-bg: #f6f7f9;
  --c-card: #ffffff;
  --c-divider: #edeff2;
  --c-text: #1a1d21;
  --c-sub: #6b7280;
  --c-brand: #0f7be0;
  --c-brand-deep: #0a4a8a;
  --c-brand-soft: #e6f1fb;
  --c-money: #0e7c6b;       /* 线框 teal：预算/金额 */
  --c-warn: #ff6a2b;        /* 暖橙：待确认动作 */
  --c-warn-soft: #fff3e6;
  --tabbar-h: calc(var(--van-tabbar-height, 50px) + env(safe-area-inset-bottom));

  min-height: 100vh;
  min-height: 100dvh;
  background: var(--c-bg);
  color: var(--c-text);
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* ---------- 顶栏标题 ---------- */
:deep(.van-nav-bar) { background: var(--c-card); }
:deep(.van-nav-bar::after) { border-color: var(--c-divider); }
:deep(.van-nav-bar .van-icon) { color: var(--c-text); }
.nav-title { text-align: center; }
.nav-title__main { display: block; font-size: 16px; font-weight: 700; color: var(--c-text); }
.nav-title__sub { font-size: 11.5px; color: var(--c-sub); display: inline-flex; gap: 4px; align-items: center; }
.nav-title__sub .dot { color: var(--c-divider); }
.nav-title__budget { color: var(--c-money); font-weight: 600; }

/* ---------- Tab 切换 ---------- */
.seg {
  display: flex;
  margin: 8px 16px 0;
  padding: 3px;
  background: #edeff2;
  border-radius: 20px;
}
.seg__btn {
  flex: 1;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  height: 32px;
  font-size: 13px; font-weight: 600;
  color: var(--c-sub);
  border-radius: 18px;
  transition: all 0.18s;
}
.seg__btn :deep(.van-icon) { font-size: 15px; }
.seg__btn.is-active {
  background: var(--c-card);
  color: var(--c-brand);
  box-shadow: 0 1px 4px rgba(10, 26, 43, 0.08);
}

/* ---------- 日期芯片 ---------- */
.days {
  display: flex;
  gap: 8px;
  padding: 12px 16px 4px;
  overflow-x: auto;
}
.days::-webkit-scrollbar { display: none; }
.day {
  flex-shrink: 0;
  min-width: 44px;
  height: 32px;
  padding: 0 14px;
  font-size: 13px; font-weight: 600;
  color: var(--c-sub);
  background: var(--c-card);
  border: 1px solid var(--c-divider);
  border-radius: 16px;
  transition: all 0.15s;
}
.day.is-active {
  background: var(--c-brand);
  color: #fff;
  border-color: var(--c-brand);
}

/* ---------- 当日头部 ---------- */
.dayhead {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px 8px;
  font-size: 12.5px;
  color: var(--c-sub);
}
.dayhead__d { font-size: 15px; font-weight: 800; color: var(--c-text); }
.dayhead__date { color: var(--c-text); font-weight: 600; }
.dayhead__weather { display: inline-flex; align-items: center; gap: 3px; }
.dayhead__weather :deep(.van-icon) { font-size: 14px; color: var(--c-money); }
.dayhead__budget { margin-left: auto; }
.dayhead__budget em { font-style: normal; font-weight: 700; color: var(--c-money); }
.dayhead--next { padding-top: 4px; border-top: 1px solid var(--c-divider); margin-top: 8px; }

/* ---------- 时间轴 ---------- */
.timeline { padding: 4px 16px 0; }
.tl {
  display: grid;
  grid-template-columns: 20px 52px 1fr;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 14px;
}
.tl__rail {
  position: relative;
  width: 20px;
  align-self: stretch;
  display: flex; flex-direction: column; align-items: center;
  padding-top: 6px;
}
.tl__dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  border: 2px solid var(--c-brand);
  background: var(--c-card);
  z-index: 1;
}
.tl__dot.now { background: var(--c-brand); }
.tl__dot.past { border-color: var(--c-divider); background: var(--c-divider); }
.tl__dot.next { border-color: var(--c-divider); }
.tl__line {
  flex: 1;
  width: 2px;
  margin-top: 2px;
  background-image: linear-gradient(var(--c-divider) 50%, transparent 50%);
  background-size: 2px 6px;
  background-repeat: repeat-y;
}
.tl__time { font-size: 13px; font-weight: 700; color: var(--c-brand); padding-top: 2px; }
.tl__card {
  display: flex;
  gap: 10px;
  align-items: center;
  background: var(--c-card);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(10, 26, 43, 0.05);
  position: relative;
}
.tl__body { flex: 1; min-width: 0; }
.tl__title { font-size: 14.5px; font-weight: 700; color: var(--c-text); }
.tl__tags { font-size: 11.5px; color: var(--c-sub); margin-top: 4px; }
.tl__media {
  width: 56px; height: 56px;
  flex-shrink: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #edeff2, #f6f7f9);
  display: grid; place-items: center;
  overflow: hidden;
}
.tl__media.is-img { background: var(--c-divider); }
.tl__media img { width: 100%; height: 100%; object-fit: cover; }
.tl__media-ic { font-size: 22px !important; color: var(--c-divider); }
.tl__check { position: absolute; top: 8px; right: 8px; color: var(--c-brand); font-size: 16px !important; }

/* ---------- AI 总结条 ---------- */
.ai-sum {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 4px 16px 0;
  padding: 12px;
  background: var(--c-brand-soft);
  border-radius: 10px;
}
.ai-sum__ic { color: var(--c-brand); flex-shrink: 0; display: flex; }
.ai-sum__ic svg { width: 16px; height: 16px; }
.ai-sum p { font-size: 12.5px; line-height: 1.55; color: var(--c-brand-deep); }

/* ---------- 次日预告 ---------- */
.next-hint {
  padding: 0 16px 12px;
  font-size: 11.5px;
  color: var(--c-sub);
}

/* ---------- AI 待确认卡 ---------- */
.pending {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 16px;
  padding: 12px;
  background: var(--c-warn-soft);
  border-radius: 12px;
}
.pending__ic {
  flex-shrink: 0;
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--c-warn);
  color: #fff;
  display: grid; place-items: center;
}
.pending__ic :deep(.van-icon) { font-size: 18px; }
.pending__body { flex: 1; min-width: 0; }
.pending__title { font-size: 13.5px; font-weight: 700; color: var(--c-text); }
.pending__sub { font-size: 11px; color: var(--c-sub); margin-top: 2px; }
.pending__btn {
  flex-shrink: 0;
  padding: 7px 16px;
  font-size: 12.5px; font-weight: 600;
  color: #fff;
  background: var(--c-warn);
  border-radius: 16px;
}

/* ---------- FAB ---------- */
.fab {
  position: fixed;
  right: 16px;
  bottom: calc(var(--tabbar-h) + 64px);
  width: 52px; height: 52px;
  border-radius: 50%;
  background: var(--c-brand);
  color: #fff;
  display: grid; place-items: center;
  box-shadow: 0 6px 18px rgba(15, 123, 224, 0.4);
  z-index: 10;
}
.fab :deep(.van-icon) { font-size: 24px; font-weight: 700; }

/* ---------- 底部操作栏（贴 tabbar 上方） ---------- */
.foot-space { height: calc(var(--tabbar-h) + 72px); }
.actionbar {
  position: fixed;
  left: 0; right: 0;
  bottom: var(--tabbar-h);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--c-card);
  border-top: 1px solid var(--c-divider);
  box-shadow: 0 -2px 12px rgba(10, 26, 43, 0.05);
  z-index: 9;
}
.actionbar__left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.actionbar__label { font-size: 11px; color: var(--c-sub); }
.actionbar__amount { font-size: 20px; font-weight: 800; color: var(--c-money); line-height: 1.1; letter-spacing: -0.02em; }
.actionbar__sub { font-size: 10.5px; color: var(--c-sub); }
.actionbar__btn {
  flex-shrink: 0;
  padding: 12px 22px;
  font-size: 14px; font-weight: 700;
  color: #fff;
  background: var(--c-brand);
  border-radius: 22px;
  box-shadow: 0 4px 12px rgba(15, 123, 224, 0.3);
}
.actionbar__btn:active { transform: scale(0.97); }
</style>
