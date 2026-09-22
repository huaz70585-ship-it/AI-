<template>
  <div class="msg-page">
    <!-- 顶栏：返回 + 消息中心 + 全部已读 -->
    <van-nav-bar left-arrow fixed placeholder @click-left="onBack" title="消息中心">
      <template #right>
        <span class="read-all" @click="readAll">全部已读</span>
      </template>
    </van-nav-bar>

    <!-- 分类筛选 -->
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

    <!-- 消息列表 · 按时间分组 -->
    <main class="list">
      <template v-for="g in groups" :key="g.label">
        <div v-if="g.items.length" class="group">
          <p class="group__label">{{ g.label }}</p>
          <article
            v-for="m in g.items"
            :key="m.id"
            class="item"
            :class="{ 'is-unread': m.unread, [`is-${m.type}`]: true }"
          >
            <div class="item__avatar" :style="{ background: m.iconBg }">
              <van-icon :name="m.icon" />
              <span v-if="m.unread" class="item__dot"></span>
            </div>
            <div class="item__body">
              <div class="item__head">
                <p class="item__title">{{ m.title }}</p>
                <span class="item__time">{{ m.time }}</span>
              </div>
              <p class="item__preview">{{ m.preview }}</p>
              <button
                v-if="m.cta"
                class="item__cta"
                :class="`cta--${m.cta.kind}`"
                @click="onCta(m)"
              >{{ m.cta.label }}</button>
            </div>
          </article>
        </div>
      </template>

      <p class="end-tip">没有更多消息了</p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'

const router = useRouter()

type CatKey = 'all' | 'trade' | 'trip' | 'social' | 'system'
const cats: { key: CatKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'trade', label: '交易' },
  { key: 'trip', label: '行程' },
  { key: 'social', label: '互动' },
  { key: 'system', label: '系统' },
]
const activeCat = ref<CatKey>('all')

interface Cta { label: string; kind: 'pay' | 'view' }
interface Msg {
  id: string
  type: Exclude<CatKey, 'all'>
  icon: string
  iconBg: string
  title: string
  preview: string
  time: string
  unread: boolean
  cta?: Cta
}

/* 占位消息数据 */
const messages = ref<Msg[]>([
  {
    id: '1', type: 'trade', icon: 'clock-o', iconBg: 'var(--c-accent)',
    title: '支付未完成，订单保留30分钟',
    preview: '「上海·4日」¥3,860 支付未成功，10:11 前可重新支付',
    time: '09:30', unread: true,
    cta: { label: '去支付', kind: 'pay' },
  },
  {
    id: '2', type: 'trip', icon: 'medal-o', iconBg: 'var(--c-brand)',
    title: '行程已按你的要求重排',
    preview: 'AI 把「陆家嘴观景台」移到上午，避开午后阵雨',
    time: '08:20', unread: true,
    cta: { label: '查看行程', kind: 'view' },
  },
  {
    id: '3', type: 'social', icon: 'bookmark-o', iconBg: 'var(--c-muted)',
    title: '你的行程被3人收藏',
    preview: '叶小舟 等3人收藏了「上海·4日」',
    time: '07:15', unread: false,
  },
  {
    id: '4', type: 'trade', icon: 'passed', iconBg: 'var(--c-accent)',
    title: '酒店预订成功',
    preview: '杭州西湖边精品酒店 · 10.12 入住1晚，已确认',
    time: '昨天 18:30', unread: false,
  },
  {
    id: '5', type: 'system', icon: 'coupon-o', iconBg: 'var(--c-muted)',
    title: '2张优惠券3天后过期',
    preview: '满500减80 · 满1000减200，逾期自动失效',
    time: '昨天 10:00', unread: false,
  },
  {
    id: '6', type: 'trip', icon: 'logistics', iconBg: 'var(--c-brand)',
    title: '「杭州·2日」可以值机了',
    preview: '距出发还有3天，值机通道已开放',
    time: '09.20', unread: false,
  },
])

/* 分类计数（未读） */
const counts = computed<Record<CatKey, number>>(() => ({
  all: messages.value.filter(m => m.unread).length,
  trade: messages.value.filter(m => m.type === 'trade' && m.unread).length,
  trip: messages.value.filter(m => m.type === 'trip' && m.unread).length,
  social: messages.value.filter(m => m.type === 'social' && m.unread).length,
  system: messages.value.filter(m => m.type === 'system' && m.unread).length,
}))

/* 按时间分组 + 分类过滤 */
const groups = computed(() => {
  const filtered = activeCat.value === 'all'
    ? messages.value
    : messages.value.filter(m => m.type === activeCat.value)
  return [
    { label: '今天', items: filtered.slice(0, 3) },
    { label: '本周', items: filtered.slice(3, 5) },
    { label: '更早', items: filtered.slice(5) },
  ]
})

function readAll() {
  messages.value.forEach(m => (m.unread = false))
  showToast({ message: '已全部标为已读', position: 'top' })
}

function onCta(m: Msg) {
  if (m.cta?.kind === 'view') router.push('/trip')
  else showToast({ message: `${m.cta?.label} · 占位`, position: 'top' })
}

function onBack() {
  router.push('/')
}
</script>

<style scoped>
.msg-page {
  /* 通用颜色 token 见 src/styles/tokens.css，下面只留本页语义别名 */
  --c-read: var(--c-sub);    /* 已读标题 */
  --c-old: var(--c-muted);   /* 时间戳 / 已读预览 */

  min-height: 100vh;
  min-height: 100dvh;
  background: var(--c-bg);
  color: var(--c-text);
  font-family: var(--font-sans);
}

/* ---------- 顶栏 ---------- */
:deep(.van-nav-bar) { background: var(--c-card); }
:deep(.van-nav-bar::after) { border-color: var(--c-divider); }
:deep(.van-nav-bar__title) { font-weight: 700; color: var(--c-text); }
:deep(.van-nav-bar .van-icon) { color: var(--c-text); }
.read-all { font-size: 13px; color: var(--c-brand); font-weight: 600; }

/* ---------- 分类筛选 ---------- */
.cats {
  display: flex;
  gap: 8px;
  padding: 10px 16px 6px;
  overflow-x: auto;
}
.cats::-webkit-scrollbar { display: none; }
.cat {
  position: relative;
  flex-shrink: 0;
  height: 30px;
  padding: 0 14px;
  font-size: 13px; font-weight: 500;
  color: var(--c-read);
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
  color: #fff;
  background: var(--c-red);
  border-radius: 8px;
  vertical-align: middle;
}
.cat.is-active .cat__badge { background: rgba(255, 255, 255, 0.3); }

/* ---------- 列表分组 ---------- */
.list { padding: 6px 12px 24px; }
.group { margin-top: 8px; }
.group__label {
  font-size: 12px; font-weight: 600;
  color: var(--c-old);
  padding: 6px 4px 8px;
}

/* ---------- 消息项 ---------- */
.item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 12px;
  margin-bottom: 8px;
  background: var(--c-card);
  border-radius: 12px;
}
.item__avatar {
  position: relative;
  width: 40px; height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  display: grid; place-items: center;
  color: #fff;
}
.item__avatar :deep(.van-icon) { font-size: 20px; }
.item__dot {
  position: absolute; top: -2px; right: -2px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--c-red);
  border: 2px solid var(--c-card);
}
.item__body { flex: 1; min-width: 0; }
.item__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.item__title {
  font-size: 14px; font-weight: 700;
  color: var(--c-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.item:not(.is-unread) .item__title { font-weight: 500; color: var(--c-read); }
.item__time { font-size: 11px; color: var(--c-old); flex-shrink: 0; }
.item__preview {
  font-size: 12.5px; line-height: 1.5;
  color: var(--c-old);
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.item:not(.is-unread) .item__preview { color: var(--c-old); opacity: 0.85; }

/* 落点按钮：事务型(支付)=暖橙实心 / 行程型(查看)=蓝描边 */
.item__cta {
  margin-top: 10px;
  padding: 6px 14px;
  font-size: 12.5px; font-weight: 600;
  border-radius: 14px;
  transition: all 0.15s;
}
.cta--pay {
  color: #fff;
  background: var(--c-accent);
  box-shadow: 0 2px 6px rgba(255, 106, 43, 0.3);
}
.cta--view {
  color: var(--c-brand-deep);
  background: var(--c-brand-soft);
  border: 1px solid var(--c-brand-soft);
}
.cta--view:active { background: #d6ebfb; }

/* ---------- 底部提示 ---------- */
.end-tip {
  text-align: center;
  font-size: 11.5px;
  color: var(--c-old);
  padding: 16px 0 8px;
  opacity: 0.7;
}
</style>
