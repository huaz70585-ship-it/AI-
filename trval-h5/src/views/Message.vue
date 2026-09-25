<template>
  <div class="msg-page">
    <!-- 顶栏：消息中心 + 全部已读（tab 落地页，无返回箭头，与行程列表页一致） -->
    <van-nav-bar fixed placeholder title="消息中心">
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getMessages, readAllMessages, type Message } from '../api/message'

const router = useRouter()

type CatKey = 'all' | 'trip' | 'system'

/**
 * 产品当前只产生「行程」「系统」两类消息 —— 没有交易系统，也没有社交关系，
 * 所以不设「交易」「互动」分类。
 *
 * 历史库里若残留 trade / social 等旧类型（早期演示数据），一律不展示：
 * 它们的落点按钮（如「去支付」）没有对应接口，点了不会有任何反应。
 */
const VISIBLE_TYPES = ['trip', 'system']

const cats: { key: CatKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'trip', label: '行程' },
  { key: 'system', label: '系统' },
]
const activeCat = ref<CatKey>('all')

/**
 * 全量消息：一次拉回，分类和计数都在本地派生。
 *
 * 改成这样是因为原来「切一次分类拉一次」有两个硬伤：
 *  ① 计数用的是「当前分类已加载的那几条」，切到「交易」后 全部/互动/系统 的徽标全变成 0；
 *  ② 快速切分类时旧响应可能后到，把新分类的列表覆盖掉（无序号校验）。
 * 单份数据 + 本地派生，两个问题一起消失，切分类也不再发请求。
 */
const allMessages = ref<Message[]>([])

async function load() {
  try {
    allMessages.value = await getMessages()
  } catch {
    allMessages.value = []
    showToast({ message: '消息加载失败', position: 'top' })
  }
}
onMounted(load)

/** 当前分类要展示的消息（本地过滤；非行程/系统类一律不展示） */
const messages = computed<Message[]>(() => {
  const visible = allMessages.value.filter(m => VISIBLE_TYPES.includes(m.type))
  return activeCat.value === 'all' ? visible : visible.filter(m => m.type === activeCat.value)
})

/* 分类计数（未读）：统计全量数据，不受当前分类影响 */
const counts = computed<Record<CatKey, number>>(() => {
  const c: Record<CatKey, number> = { all: 0, trip: 0, system: 0 }
  for (const m of allMessages.value) {
    if (!m.unread || !VISIBLE_TYPES.includes(m.type)) continue
    c.all += 1
    c[m.type as CatKey] += 1
  }
  return c
})

/* 按真实日期分组 */
const DAY_MS = 86_400_000
const groups = computed(() => {
  const now = new Date()
  // 今天 0 点；「本周」按近 7 天（含今天）算，比自然周的边界更符合直觉
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekStart = todayStart - 6 * DAY_MS

  const buckets: { label: string; items: Message[] }[] = [
    { label: '今天', items: [] },
    { label: '本周', items: [] },
    { label: '更早', items: [] },
  ]
  for (const m of messages.value) {
    const t = Date.parse(m.createdAt)
    if (Number.isNaN(t)) buckets[2].items.push(m)
    else if (t >= todayStart) buckets[0].items.push(m)
    else if (t >= weekStart) buckets[1].items.push(m)
    else buckets[2].items.push(m)
  }
  return buckets
})

async function readAll() {
  try {
    await readAllMessages()
    allMessages.value.forEach(m => (m.unread = false))
    showToast({ message: '已全部标为已读', position: 'top' })
  } catch {
    showToast({ message: '操作失败，请重试', position: 'top' })
  }
}

function onCta(m: Message) {
  if (m.cta?.kind === 'view') router.push('/trip')
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
  padding: 10px 20px 6px;
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
/* tab 落地页：底部给 tabbar 让位（原为全屏页只有 24px 留白） */
.list {
  --tabbar-h: calc(var(--van-tabbar-height, 50px) + env(safe-area-inset-bottom));
  padding: 6px 20px calc(var(--tabbar-h) + 16px);
}
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
.cta--view:active { background: var(--c-brand-soft); }

/* ---------- 底部提示 ---------- */
.end-tip {
  text-align: center;
  font-size: 11.5px;
  color: var(--c-old);
  padding: 16px 0 8px;
  opacity: 0.7;
}
</style>
