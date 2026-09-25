<template>
  <div class="chat">
    <!-- 顶栏 -->
    <van-nav-bar title="途灵 · AI 行程" left-arrow fixed placeholder @click-left="onBack">
      <template #right>
        <van-icon name="ellipsis" size="20" />
      </template>
    </van-nav-bar>

    <!-- ① 信息流消息区（卡片化 · 全宽 · 无聊天气泡） -->
    <main ref="msgsRef" class="feed">
      <template v-for="m in messages" :key="m.id">
        <!-- ── 用户提问条（右对齐 · 用户头像在右 · 品牌浅蓝） ── -->
        <section v-if="m.role === 'user'" class="q">
          <p class="q__text">{{ m.text }}</p>
          <span class="q__ic">
            <img v-if="userStore.profile?.avatar" :src="userStore.profile.avatar" alt="" class="q__ic-img" />
            <van-icon v-else name="user-o" />
          </span>
        </section>

        <!-- ── AI 回复卡片（全宽白卡 · 左侧品牌竖线 · 卡片信息流风格） ── -->
        <article v-else class="a">
          <!-- 卡片头：AI 图标 + 途灵标识 -->
          <header class="a__head">
            <span class="a__ic">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" fill="currentColor"/>
              </svg>
            </span>
            <span class="a__name">途灵</span>
            <span class="a__tag">AI 行程规划</span>
          </header>

          <!-- ② 正文段落（信息流文本） -->
          <p v-if="m.text" class="a__text">{{ m.text }}</p>

          <!-- ② 引用与来源（可展开角标 · 信息流内嵌） -->
          <button
            v-if="m.citation"
            class="cite"
            :class="{ 'is-open': m.citeOpen }"
            @click="m.citeOpen = !m.citeOpen"
          >
            <van-icon name="bookmark-o" />
            <span>引用 {{ m.citation.length }} 篇来源</span>
            <van-icon :name="m.citeOpen ? 'arrow-up' : 'arrow-down'" />
          </button>
          <ul v-if="m.citeOpen" class="cite__list">
            <li v-for="(c, i) in m.citation" :key="i">
              <span class="cite__idx">{{ i + 1 }}</span>
              <span class="cite__name">{{ c.name }}</span>
              <span class="cite__src">{{ c.src }}</span>
            </li>
          </ul>

          <!-- ③ 结构化行程（时间轴卡片 · 直接内嵌在 AI 卡片中） -->
          <section v-if="m.product" class="trip">
            <div class="trip__head">
              <span class="trip__title">{{ m.product.title }}</span>
              <span class="trip__badge">可编辑</span>
            </div>
            <!-- 时间轴：rail + day + desc（参考 Trip.vue .tl 结构） -->
            <div class="trip__tl">
              <div v-for="(d, i) in m.product.days" :key="i" class="tl">
                <div class="tl__rail">
                  <span class="tl__dot"></span>
                  <span v-if="i < m.product.days.length - 1" class="tl__line"></span>
                </div>
                <div class="tl__day">D{{ i + 1 }}</div>
                <div class="tl__desc">{{ d }}</div>
              </div>
            </div>
            <div class="trip__foot">
              <span class="trip__hint">拖拽改天数 · 替换景点 · 实时改价</span>
              <button class="trip__save" @click="onSaveTrip(m)">
                <van-icon name="down" /> 保存到行程
              </button>
            </div>
          </section>

          <!-- ④ 消息操作栏（卡片底部 · 小图标行） -->
          <footer class="a__bar">
            <button class="a__act"><van-icon name="description" /> 复制</button>
            <button class="a__act"><van-icon name="replay" /> 重试</button>
            <button class="a__act"><van-icon name="edit" /> 编辑</button>
            <button class="a__act"><van-icon name="feedback" /> 反馈</button>
          </footer>
        </article>
      </template>

      <!-- 打字指示器（卡片化加载状态） -->
      <article v-if="thinking" class="a a--loading">
        <header class="a__head">
          <span class="a__ic">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" fill="currentColor"/>
            </svg>
          </span>
          <span class="a__name">途灵</span>
          <span class="a__tag">正在规划…</span>
        </header>
        <div class="typing"><span></span><span></span><span></span></div>
      </article>
    </main>

    <!-- ⑤ 建议芯片（输入栏上方 · pill 形状） -->
    <div class="suggest">
      <button
        v-for="s in suggestions"
        :key="s"
        class="suggest__chip"
        @click="onSuggest(s)"
      >{{ s }}</button>
    </div>

    <!-- ⑥ 输入条（底部固定 · 简洁） -->
    <footer class="input">
      <input
        v-model="text"
        class="input__field"
        placeholder="告诉途灵你的旅行计划…"
        @keyup.enter="onSend"
      />
      <button class="input__send" :disabled="!text.trim()" @click="onSend" aria-label="发送">
        <van-icon name="arrow" />
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { streamChat } from '../api/chat'
import { saveTrip } from '../api/travel'
import { getProfile } from '../api/user'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()
// 用户头像来源（提问条右侧展示）
const userStore = useUserStore()

interface Citation { name: string; src: string }
interface Product { title: string; days: string[] }
interface Msg {
  id: string
  role: 'user' | 'ai'
  text?: string
  /** 原始完整文本（含 JSON 代码块），用于构建 history 发给 AI */
  rawText?: string
  citation?: Citation[]
  citeOpen?: boolean
  product?: Product
}

let seq = 0
// id 只用作 v-for 的 key，但必须全局唯一：历史消息的 id 从 localStorage 恢复，
// seq 若每次刷新从 0 重新计数，新消息 id 会和历史撞（新 user 消息 = m1 = 恢复的第一条）
const uid = () => `m${Date.now().toString(36)}${(++seq).toString(36)}`

const msgsRef = ref<HTMLElement | null>(null)
const thinking = ref(false)
const text = ref('')

/* 历史对话持久化（localStorage） */
const STORAGE_KEY = 'travel_chat_history'
const WELCOME = '你好，我是途灵旅行助手。告诉我目的地、天数和预算，我帮你规划行程。'

const messages = ref<Msg[]>([])

function loadHistory(): Msg[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr = raw ? (JSON.parse(raw) as Msg[]) : null
    if (!arr || !Array.isArray(arr) || !arr.length) return null
    // 兼容旧数据：rawText 缺失时从 product 重建，确保 history 含 JSON
    arr.forEach(m => {
      if (!m.rawText && m.product) {
        m.rawText = m.text + '\n```json\n' + JSON.stringify(m.product) + '\n```'
      }
    })
    return arr
  } catch { return null }
}
function saveHistory() {
  try {
    if (messages.value.length > 1) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.value))
  } catch {}
}

/* ⑤ 建议芯片 */
const suggestions = ref(['加点亲子项目', '换更省预算的方案', '生成机票提醒'])

function scrollBottom() {
  nextTick(() => {
    const el = msgsRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

/* AI 流式对话：streamChat → onToken 累积文本 → onDone 收尾
   组件卸载时 abort 避免泄漏 */
let controller: AbortController | null = null

function onSend() {
  const content = text.value.trim()
  if (!content || controller) return
  // 取最近 10 条消息作为上下文（用 rawText 保留 JSON 块，让 AI 持续输出 JSON 格式）
  const history = messages.value
    .filter(m => m.rawText || m.text)
    .slice(-10)
    .map(m => ({ role: m.role, text: m.rawText || m.text! }))
  messages.value.push({ id: uid(), role: 'user', text: content })
  text.value = ''
  thinking.value = true
  scrollBottom()

  const aiIdx = messages.value.length
  messages.value.push({ id: uid(), role: 'ai', text: '' })
  controller = streamChat(
    { message: content, history },
    {
      onToken: (delta) => {
        thinking.value = false
        messages.value[aiIdx].text += delta
        scrollBottom()
      },
      onDone: () => {
        thinking.value = false
        controller = null
        const msg = messages.value[aiIdx]
        if (!msg.text) {
          msg.text = '（未收到回复，请重试）'
        } else {
          // 保存原始完整文本（含 JSON），用于构建 history
          msg.rawText = msg.text
          // 解析 AI 输出的 ```json 行程块，填入 product 结构化渲染。
          // intent 是后端 prompt 约定的行程标记：模型在美食/单点问答里误吐 json 时，
          // intent 不是 'plan' 就不当行程渲染（undefined 兜底为 plan，兼容旧会话的旧格式）
          const m = msg.text.match(/```json\s*([\s\S]*?)```/)
          if (m) {
            try {
              const product = JSON.parse(m[1].trim())
              if (product.title && Array.isArray(product.days) && (product.intent ?? 'plan') === 'plan') {
                msg.product = { title: product.title, days: product.days }
                msg.text = msg.text.replace(/```json[\s\S]*?```/g, '').trim()
              }
            } catch {}
          }
        }
        scrollBottom()
      },
      onError: (err) => {
        thinking.value = false
        controller = null
        messages.value[aiIdx].text = `请求失败：${err.message}`
        scrollBottom()
      },
    },
  )
}

onUnmounted(() => controller?.abort())

async function onSaveTrip(m: Msg) {
  if (!m.product) return
  try {
    await saveTrip({ title: m.product.title, days: m.product.days })
    showToast('已保存到我的行程')
    router.push('/trip')
  } catch {}
}

function onSuggest(s: string) {
  text.value = s
  onSend()
}

function onBack() {
  router.back()
}

/* 从首页带需求进入：预填并自动发送 */
onMounted(() => {
  // 刷新后 pinia 状态丢失，补拉一次资料，保证提问条头像稳定显示
  if (!userStore.profile) {
    getProfile().then(p => userStore.setProfile(p)).catch(() => {})
  }
  const hist = loadHistory()
  if (hist) {
    messages.value = hist
  } else {
    messages.value = [{ id: uid(), role: 'ai', text: WELCOME }]
  }
  const q = route.query.q
  if (q && typeof q === 'string' && q.trim()) {
    text.value = q
    onSend()
  } else {
    scrollBottom()
  }
})

watch(messages, saveHistory, { deep: true })
</script>

<style scoped>
/* 卡片信息流风格：去掉聊天气泡，AI 回复=全宽白卡，用户输入=紧凑提问条 */
.chat {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--c-bg);
}

/* nav-bar 透明融入 */
:deep(.van-nav-bar) { background: var(--c-card); }
:deep(.van-nav-bar::after) { border-color: var(--c-divider); }
:deep(.van-nav-bar__title) { font-weight: 700; color: var(--c-text); }
:deep(.van-nav-bar .van-icon) { color: var(--c-text); }

/* ---------- ① 信息流消息区 ---------- */
.feed {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  -webkit-overflow-scrolling: touch;
}

/* ---------- 用户提问条（右对齐 · 品牌浅蓝 · 右侧用户头像） ---------- */
.q {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  justify-content: flex-end;
}
.q__text {
  /* 限宽放在气泡自身：放在 .q 上会让 .q 塌成 0 宽，文字被逐字换行 */
  max-width: 78%;
  margin: 0;
  padding: 10px 12px;
  background: var(--c-brand-soft);
  /* 右上角靠近头像，收窄成小圆角形成指向 */
  border-radius: 12px 4px 12px 12px;
  font-size: 14px; font-weight: 500;
  color: var(--c-brand-deep);
  line-height: 1.5;
  word-break: break-word;
}
.q__ic {
  flex-shrink: 0;
  width: 30px; height: 30px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--c-brand);
  color: #fff;
  display: grid; place-items: center;
  margin-top: 1px;
}
.q__ic-img { width: 100%; height: 100%; object-fit: cover; }
.q__ic :deep(.van-icon) { font-size: 17px; }

/* ---------- AI 回复卡片（全宽白卡 · 左侧品牌竖线） ---------- */
.a {
  background: var(--c-card);
  border-radius: 12px;
  border-left: 3px solid var(--c-brand);
  padding: 14px;
  box-shadow: 0 1px 4px rgba(10, 26, 43, 0.04);
}
.a--loading { border-left-color: var(--c-divider); }

/* 卡片头：AI 图标 + 途灵标识 */
.a__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.a__ic {
  flex-shrink: 0;
  width: 22px; height: 22px;
  color: var(--c-brand);
  display: grid; place-items: center;
}
.a__ic svg { width: 18px; height: 18px; }
.a__name { font-size: 14px; font-weight: 700; color: var(--c-text); }
.a__tag {
  font-size: 11px; font-weight: 500;
  color: var(--c-sub);
  padding: 2px 8px;
  background: var(--c-bg);
  border-radius: 4px;
}

/* 正文段落（<p> 自带默认外边距，需显式清零） */
.a__text {
  margin: 10px 0 0;
  font-size: 14px; line-height: 1.65;
  color: var(--c-text);
  word-break: break-word;
  white-space: pre-wrap;
}

/* ---------- ② 引用与来源（信息流内嵌） ---------- */
.cite {
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 11px; font-weight: 600;
  color: var(--c-brand-deep);
  background: var(--c-brand-soft);
  border: 1px solid var(--c-brand-line);
  border-radius: 6px;
}
.cite :deep(.van-icon) { font-size: 13px; }
.cite__list {
  list-style: none;
  margin: 6px 0 0;
  padding: 8px 10px;
  background: var(--c-bg);
  border-radius: 8px;
  border: 1px solid var(--c-divider);
}
.cite__list li { display: flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 3px 0; }
.cite__idx {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--c-brand); color: #fff;
  font-size: 10px; font-weight: 700;
  display: grid; place-items: center; flex-shrink: 0;
}
.cite__name { color: var(--c-text); flex: 1; }
.cite__src { color: var(--c-sub); font-size: 10.5px; }

/* ---------- ③ 结构化行程（时间轴卡片 · 内嵌 AI 卡片） ---------- */
.trip {
  margin-top: 12px;
  background: var(--c-bg);
  border-radius: 10px;
  border: 1px solid var(--c-divider);
  overflow: hidden;
}
.trip__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--c-divider);
}
.trip__title { font-size: 13.5px; font-weight: 700; color: var(--c-text); }
.trip__badge {
  font-size: 10px; font-weight: 600;
  color: var(--c-brand);
  background: var(--c-brand-soft);
  padding: 2px 8px; border-radius: 4px;
}
/* 时间轴：rail + day + desc（参考 Trip.vue .tl） */
.trip__tl { padding: 8px 12px; }
.tl {
  display: grid;
  grid-template-columns: 16px 36px 1fr;
  gap: 8px;
  align-items: flex-start;
}
.tl__rail {
  position: relative;
  width: 16px;
  align-self: stretch;
  display: flex; flex-direction: column; align-items: center;
  padding-top: 5px;
}
.tl__dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--c-brand);
  flex-shrink: 0;
  z-index: 1;
}
.tl__line {
  flex: 1;
  width: 2px;
  margin-top: 2px;
  background-image: linear-gradient(var(--c-divider) 50%, transparent 50%);
  background-size: 2px 5px;
  background-repeat: repeat-y;
}
.tl__day {
  font-size: 12px; font-weight: 700;
  color: var(--c-brand);
  padding-top: 1px;
}
.tl__desc {
  font-size: 12.5px; line-height: 1.55;
  color: var(--c-text);
  word-break: break-word;
  padding-bottom: 10px;
}
.trip__foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--c-divider);
}
.trip__hint { font-size: 10.5px; color: var(--c-sub); }
.trip__save {
  flex-shrink: 0;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 14px;
  font-size: 12px; font-weight: 600;
  color: #fff;
  background: var(--c-brand);
  border: none; border-radius: 14px;
  transition: all 0.15s;
}
.trip__save :deep(.van-icon) { font-size: 13px; }
.trip__save:active { transform: scale(0.95); }

/* ---------- ④ 消息操作栏（卡片底部小图标行） ---------- */
.a__bar {
  display: flex;
  gap: 2px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--c-divider);
}
.a__act {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 10px;
  font-size: 11px; font-weight: 500;
  color: var(--c-sub);
  background: transparent;
  border: none; border-radius: 6px;
  transition: all 0.15s;
}
.a__act :deep(.van-icon) { font-size: 13px; }
.a__act:active { color: var(--c-brand); background: var(--c-brand-soft); }

/* 打字指示器 */
.typing {
  margin-top: 10px;
  display: inline-flex; gap: 5px; align-items: center;
}
.typing span {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--c-sub);
  animation: blink 1.2s infinite ease-in-out;
}
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }

/* ---------- ⑤ 建议芯片（pill 形状） ---------- */
.suggest {
  display: flex;
  gap: 8px;
  padding: 8px 12px 6px;
  overflow-x: auto;
  flex-shrink: 0;
}
.suggest::-webkit-scrollbar { display: none; }
.suggest__chip {
  flex-shrink: 0;
  padding: 6px 16px;
  font-size: 12.5px; font-weight: 500;
  color: var(--c-brand-deep);
  background: var(--c-card);
  border: 1px solid var(--c-brand-line);
  border-radius: 16px;
  white-space: nowrap;
  transition: all 0.15s;
}
.suggest__chip:active { background: var(--c-brand-soft); }

/* ---------- ⑥ 输入条（底部固定 · 简洁） ---------- */
.input {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px calc(env(safe-area-inset-bottom) + 8px);
  background: var(--c-card);
  border-top: 1px solid var(--c-divider);
}
.input__field {
  flex: 1; min-width: 0;
  height: 38px;
  padding: 0 14px;
  font-size: 14px;
  color: var(--c-text);
  background: var(--c-bg);
  border: 1px solid var(--c-divider);
  border-radius: 19px;
  outline: none;
}
.input__field::placeholder { color: var(--c-sub); }
.input__send {
  width: 38px; height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--c-brand);
  color: #fff;
  display: grid; place-items: center;
  transition: all 0.15s;
}
.input__send:disabled { background: var(--c-divider); color: var(--c-sub); }
.input__send:not(:disabled):active { transform: scale(0.92); }
.input__send :deep(.van-icon) { font-size: 16px; font-weight: 700; }
</style>
