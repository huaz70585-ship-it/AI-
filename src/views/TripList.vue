<template>
  <div class="triplist">
    <!-- 顶栏：底部 Tab 落地页，刻意不带返回箭头 -->
    <van-nav-bar title="我的行程" fixed placeholder>
      <template #right>
        <van-icon name="plus" size="20" @click="goPlan" />
      </template>
    </van-nav-bar>

    <!-- 状态筛选（带数量） -->
    <div class="cats">
      <button
        v-for="c in cats"
        :key="c.key"
        class="cat"
        :class="{ 'is-active': c.key === activeCat }"
        @click="activeCat = c.key"
      >
        {{ c.label }}
        <span v-if="counts[c.key]" class="cat__badge">{{ counts[c.key] }}</span>
      </button>
    </div>

    <!-- 行程列表 -->
    <main class="list">
      <article
        v-for="t in visibleTrips"
        :key="t.id"
        class="trip"
        @click="goDetail(t)"
      >
        <div class="trip__row">
          <div class="trip__body">
            <p class="trip__route">{{ t.title }}</p>
            <p class="trip__meta">{{ t.dateRange }} · {{ t.people }}人</p>
            <span class="trip__state" :class="`state--${t.style}`">
              {{ t.stateText }}
            </span>
          </div>
          <div class="trip__media">
            <van-icon name="photo-o" class="trip__media-ic" />
          </div>
        </div>

        <div class="trip__foot">
          <span class="trip__progress">
            {{ t.itemCount }} 项安排<template v-if="t.pending > 0"> · <em>{{ t.pending }} 项待预订</em></template>
          </span>
          <span class="trip__go">
            {{ t.pending > 0 ? '去预订' : '查看' }}
            <van-icon name="arrow" />
          </span>
        </div>
      </article>

      <!-- 空状态：把"没行程"变成一次转化机会 -->
      <div v-if="!visibleTrips.length" class="empty">
        <span class="empty__ic">
          <van-icon name="calendar-o" />
        </span>
        <p class="empty__title">还没有行程</p>
        <p class="empty__sub">说说目的地和天数，AI 帮你把每天排好</p>
        <button class="empty__btn" @click="goPlan">让 AI 帮我规划</button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

type CatKey = 'all' | 'upcoming' | 'generating' | 'done'
type TripState = 'generating' | 'upcoming' | 'ongoing' | 'done'

interface TripCard {
  id: string
  title: string
  dateRange: string
  people: number
  state: TripState
  stateText: string
  style: 'ai' | 'soon' | 'live' | 'done'
  itemCount: number
  pending: number
}

const cats: { key: CatKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'upcoming', label: '待出行' },
  { key: 'generating', label: '规划中' },
  { key: 'done', label: '已完成' },
]
const activeCat = ref<CatKey>('all')

/* 占位数据：等接口契约落地后替换为 GET /v1/trips */
const trips = ref<TripCard[]>([
  {
    id: 't4',
    title: '大理 · 3日',
    dateRange: '09.28 - 09.30',
    people: 2,
    state: 'ongoing',
    stateText: '进行中 · D2',
    style: 'live',
    itemCount: 7,
    pending: 1,
  },
  {
    id: 't1',
    title: '上海 · 4日',
    dateRange: '10.12 - 10.15',
    people: 2,
    state: 'upcoming',
    stateText: '3天后出发',
    style: 'soon',
    itemCount: 8,
    pending: 2,
  },
  {
    id: 't2',
    title: '杭州 · 2日',
    dateRange: '11.02 - 11.03',
    people: 1,
    state: 'generating',
    stateText: 'AI 规划中',
    style: 'ai',
    itemCount: 0,
    pending: 0,
  },
  {
    id: 't3',
    title: '京都 · 5日',
    dateRange: '08.15 - 08.19',
    people: 2,
    state: 'done',
    stateText: '已完成',
    style: 'done',
    itemCount: 12,
    pending: 0,
  },
  {
    id: 't5',
    title: '厦门 · 3日',
    dateRange: '07.04 - 07.06',
    people: 3,
    state: 'done',
    stateText: '已完成',
    style: 'done',
    itemCount: 9,
    pending: 0,
  },
])

/* 过滤：待出行同时容纳进行中与未出发 */
const visibleTrips = computed(() => {
  if (activeCat.value === 'all') return trips.value
  if (activeCat.value === 'upcoming') {
    return trips.value.filter(t => t.state === 'upcoming' || t.state === 'ongoing')
  }
  return trips.value.filter(t => t.state === activeCat.value)
})

const counts = computed<Record<CatKey, number>>(() => ({
  all: trips.value.length,
  upcoming: trips.value.filter(t => t.state === 'upcoming' || t.state === 'ongoing').length,
  generating: trips.value.filter(t => t.state === 'generating').length,
  done: trips.value.filter(t => t.state === 'done').length,
}))

function goDetail(t: TripCard) {
  router.push(`/trip/${t.id}`)
}

function goPlan() {
  router.push('/chat')
}
</script>

<style scoped>
.triplist {
  --c-bg: #f6f7f9;
  --c-card: #ffffff;
  --c-divider: #edeff2;
  --c-text: #1a1d21;
  --c-sub: #6b7280;
  --c-old: #8a939f;
  --c-brand: #0f7be0;
  --c-brand-deep: #0a4a8a;
  --c-brand-soft: #e6f1fb;
  --c-warn: #ff6a2b;
  --c-warn-soft: #fff3e6;
  --tabbar-h: calc(var(--van-tabbar-height, 50px) + env(safe-area-inset-bottom));

  min-height: 100vh;
  min-height: 100dvh;
  background: var(--c-bg);
  color: var(--c-text);
  padding-bottom: calc(var(--tabbar-h) + 16px);
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* ---------- 顶栏 ---------- */
:deep(.van-nav-bar) { background: var(--c-card); }
:deep(.van-nav-bar::after) { border-color: var(--c-divider); }
:deep(.van-nav-bar__title) { font-weight: 700; color: var(--c-text); }
:deep(.van-nav-bar .van-icon) { color: var(--c-text); }

/* ---------- 状态筛选 ---------- */
.cats {
  display: flex;
  gap: 8px;
  padding: 10px 16px 6px;
  overflow-x: auto;
}
.cats::-webkit-scrollbar { display: none; }
.cat {
  flex-shrink: 0;
  height: 30px;
  padding: 0 14px;
  font-size: 13px; font-weight: 500;
  color: var(--c-sub);
  background: var(--c-card);
  border: 1px solid var(--c-divider);
  border-radius: 15px;
  transition: all 0.15s;
}
.cat.is-active {
  background: var(--c-brand);
  color: #fff;
  border-color: var(--c-brand);
}
.cat__badge {
  display: inline-grid; place-items: center;
  min-width: 16px; height: 16px;
  margin-left: 4px;
  padding: 0 4px;
  font-size: 10px; font-weight: 700;
  color: var(--c-sub);
  background: var(--c-divider);
  border-radius: 8px;
  vertical-align: middle;
}
.cat.is-active .cat__badge { color: #fff; background: rgba(255, 255, 255, 0.3); }

/* ---------- 列表 ---------- */
.list { padding: 6px 16px 0; }

/* ---------- 行程卡 ---------- */
.trip {
  background: var(--c-card);
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(10, 26, 43, 0.05);
  cursor: pointer;
  transition: transform 0.15s;
}
.trip:active { transform: translateY(1px); }

.trip__row { display: flex; gap: 12px; align-items: stretch; }
.trip__body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.trip__route {
  font-size: 16px; font-weight: 700;
  color: var(--c-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.trip__meta { font-size: 12px; color: var(--c-sub); margin-top: 4px; }
.trip__state {
  margin-top: auto;
  align-self: flex-start;
  font-size: 11px; font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
}
.state--ai { color: var(--c-brand-deep); background: var(--c-brand-soft); }
.state--soon { color: var(--c-warn); background: var(--c-warn-soft); }
.state--live { color: #fff; background: var(--c-brand); }
.state--done { color: var(--c-sub); background: var(--c-divider); }

/* 封面位：等接入真实封面 URL 后替换为 img，占位语言与首页卡片一致 */
.trip__media {
  position: relative;
  width: 88px;
  flex-shrink: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #edeff2 0%, #f6f7f9 100%);
  display: grid; place-items: center;
  overflow: hidden;
}
.trip__media::after {
  content: '';
  position: absolute; inset: 0;
  background: rgba(15, 123, 224, 0.05);
  border-radius: 10px;
}
.trip__media-ic {
  position: relative;
  z-index: 1;
  font-size: 24px !important;
  color: var(--c-divider);
}

.trip__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--c-divider);
}
.trip__progress { font-size: 11.5px; color: var(--c-sub); }
.trip__progress em { font-style: normal; font-weight: 600; color: var(--c-text); }
.trip__go {
  display: inline-flex; align-items: center; gap: 2px;
  flex-shrink: 0;
  font-size: 12px; font-weight: 600;
  color: var(--c-brand);
}
.trip__go :deep(.van-icon) { font-size: 12px; }

/* ---------- 空状态 ---------- */
.empty { padding: 56px 24px 24px; text-align: center; }
.empty__ic {
  display: grid; place-items: center;
  width: 64px; height: 64px;
  margin: 0 auto;
  border-radius: 50%;
  background: var(--c-brand-soft);
  color: var(--c-brand);
}
.empty__ic :deep(.van-icon) { font-size: 30px; }
.empty__title { font-size: 15px; font-weight: 700; color: var(--c-text); margin-top: 14px; }
.empty__sub {
  font-size: 12.5px; line-height: 1.6;
  color: var(--c-sub);
  margin-top: 6px;
}
.empty__btn {
  margin-top: 18px;
  padding: 11px 28px;
  font-size: 14px; font-weight: 700;
  color: #fff;
  background: var(--c-brand);
  border-radius: 22px;
  box-shadow: 0 4px 12px rgba(15, 123, 224, 0.3);
}
.empty__btn:active { transform: scale(0.97); }
</style>
