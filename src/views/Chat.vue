<template>
  <div class="chat">
    <!-- 顶栏 -->
    <van-nav-bar title="旅行助手" left-arrow fixed placeholder @click-left="onBack">
      <template #right>
        <van-icon name="ellipsis" size="20" />
      </template>
    </van-nav-bar>

    <!-- ① 消息区 -->
    <main ref="msgsRef" class="msgs">
      <template v-for="m in messages" :key="m.id">
        <!-- AI 消息 -->
        <div v-if="m.role === 'ai'" class="msg msg--ai">
          <div class="msg__avatar">AI</div>
          <div class="msg__col">
            <!-- 气泡（单条最长 85%） -->
            <div class="msg__bubble">
              <p v-if="m.text">{{ m.text }}</p>

              <!-- ② 引用与来源（可展开角标） -->
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

              <!-- ③ 结构化产物（卡片 + 时间轴，非纯文字） -->
              <div v-if="m.product" class="product">
                <div class="product__head">
                  <span class="product__title">{{ m.product.title }}</span>
                  <span class="product__edit">可编辑</span>
                </div>
                <div class="product__body">
                  <!-- 左：绿色时间轴子块 -->
                  <div class="timeline">
                    <span
                      v-for="n in m.product.days.length"
                      :key="n"
                      class="timeline__item"
                    >
                      <span class="timeline__dot"></span>
                      <span class="timeline__label">D{{ n }}</span>
                      <span v-if="n < m.product.days.length" class="timeline__line"></span>
                    </span>
                  </div>
                  <!-- 右：文本行 -->
                  <ul class="product__lines">
                    <li v-for="(d, i) in m.product.days" :key="i">
                      <span class="product__day">Day {{ i + 1 }}</span>
                      <span class="product__desc">{{ d }}</span>
                    </li>
                  </ul>
                </div>
                <div class="product__foot">
                  <span>拖拽改天数 · 替换景点 · 实时改价</span>
                  <van-icon name="edit" />
                </div>
              </div>
            </div>

            <!-- ④ 消息操作条（气泡下方） -->
            <div class="actions">
              <button class="actions__btn"><van-icon name="description" />复制</button>
              <button class="actions__btn"><van-icon name="replay" />重试</button>
              <button class="actions__btn"><van-icon name="edit" />编辑</button>
              <button class="actions__btn"><van-icon name="feedback" />反馈</button>
            </div>
          </div>
        </div>

        <!-- 用户消息（右） -->
        <div v-else class="msg msg--user">
          <div class="msg__bubble msg__bubble--user">{{ m.text }}</div>
        </div>
      </template>

      <!-- 打字指示器 -->
      <div v-if="thinking" class="msg msg--ai">
        <div class="msg__avatar">AI</div>
        <div class="msg__bubble typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    </main>

    <!-- ⑤ 建议芯片 -->
    <div class="suggest">
      <button
        v-for="s in suggestions"
        :key="s"
        class="suggest__chip"
        @click="onSuggest(s)"
      >{{ s }}</button>
    </div>

    <!-- ⑥ 输入条 -->
    <footer class="input">
      <div class="input__toggles">
        <button
          class="toggle"
          :class="{ 'is-on': web }"
          @click="web = !web"
        ><van-icon name="search" /> 联网</button>
        <button
          class="toggle"
          :class="{ 'is-on': deep }"
          @click="deep = !deep"
        ><van-icon name="medal-o" /> 深度思考</button>
      </div>
      <div class="input__row">
        <button class="input__ic" aria-label="语音"><van-icon name="voice-o" /></button>
        <button class="input__ic" aria-label="图片"><van-icon name="photo-o" /></button>
        <input
          v-model="text"
          class="input__field"
          placeholder="问问旅行助手…"
          @keyup.enter="onSend"
        />
        <button class="input__send" :disabled="!text.trim()" @click="onSend" aria-label="发送">
          <van-icon name="arrow" />
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

interface Citation { name: string; src: string }
interface Product { title: string; days: string[] }
interface Msg {
  id: string
  role: 'user' | 'ai'
  text?: string
  citation?: Citation[]
  citeOpen?: boolean
  product?: Product
}

let seq = 0
const uid = () => `m${++seq}`

const msgsRef = ref<HTMLElement | null>(null)
const thinking = ref(false)
const text = ref('')
const web = ref(false)
const deep = ref(false)

/* 占位对话种子 */
const messages = ref<Msg[]>([
  {
    id: uid(),
    role: 'ai',
    text: '你好，我是旅行助手。告诉我目的地、天数和预算，我帮你排好行程。',
  },
  {
    id: uid(),
    role: 'user',
    text: '想去京都，5 天，预算 8000',
  },
  {
    id: uid(),
    role: 'ai',
    text: '已为你生成京都 5 天行程，可拖拽改天数或替换景点：',
    citation: [
      { name: '京都观光局官方指南', src: 'kyoto.travel' },
      { name: '5 月樱花前线数据', src: 'sakura.weathermap.jp' },
      { name: '岚山交通时刻表', src: 'arashiyama.jr-west' },
    ],
    citeOpen: false,
    product: {
      title: '京都 5 日禅意漫游',
      days: ['抵达京都 · 清水寺夜赏', '伏见稻荷 · 千本鸟居', '岚山竹林 · 渡月桥', '金阁寺 · 鸭川漫步', '返程 · 锦市场采购'],
    },
  },
])

/* ⑤ 建议芯片 */
const suggestions = ref(['加点亲子项目', '换更省预算的方案', '生成机票提醒'])

function scrollBottom() {
  nextTick(() => {
    const el = msgsRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

/* 发送（占位 mock：用户气泡 → 思考 → AI 结构化回复）
   后续接入 SSE 时替换为 streamChat({ message }, { onToken, onDone, onError }) */
function onSend() {
  const content = text.value.trim()
  if (!content) return
  messages.value.push({ id: uid(), role: 'user', text: content })
  text.value = ''
  thinking.value = true
  scrollBottom()
  setTimeout(() => {
    thinking.value = false
    messages.value.push({
      id: uid(),
      role: 'ai',
      text: `已围绕「${content}」生成行程草案：`,
      citation: [
        { name: '目的地官方攻略', src: 'travel.example' },
        { name: '实时汇率与交通', src: 'data.example' },
      ],
      citeOpen: false,
      product: {
        title: '基于你的需求 · 行程草案',
        days: ['Day 1 抵达', 'Day 2 核心景点', 'Day 3 深度体验', 'Day 4 周边扩展', 'Day 5 返程'],
      },
    })
    // 每轮回答后追问 2-3 个
    suggestions.value = ['再细化 Day 2', '换个目的地', '导出为行程卡']
    scrollBottom()
  }, 1200)
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
  const q = route.query.q
  if (q && typeof q === 'string' && q.trim()) {
    text.value = q
    onSend()
  } else {
    scrollBottom()
  }
})
</script>

<style scoped>
/* 沿用首页三层体系 + 线框专用色 */
.chat {
  --c-bg: #f6f7f9;
  --c-card: #ffffff;
  --c-divider: #edeff2;
  --c-text: #1a1d21;
  --c-sub: #6b7280;
  --c-brand: #0f7be0;
  --c-brand-deep: #0a4a8a;
  --c-chip-bg: #e6f1fb;
  --c-chip-border: #85b7eb;
  --c-ai-bubble: #f1efe8;       /* AI 灰气泡（线框 #F1EFE8） */
  --c-user-bubble: #b5d4f4;     /* 用户蓝气泡（线框 #B5D4F4） */
  --c-product-bg: #e6f1fb;
  --c-product-border: #85b7eb;
  --c-timeline-bg: #e1f5ee;     /* 绿色时间轴子块 */
  --c-timeline-border: #5dcaa5;
  --c-timeline-dot: #1d9e75;

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

/* ---------- ① 消息区 ---------- */
.msgs {
  flex: 1;
  overflow-y: auto;
  padding: 12px 12px 4px;
  -webkit-overflow-scrolling: touch;
}
.msg {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  align-items: flex-start;
}
.msg--ai { flex-direction: row; }
.msg--user { flex-direction: row-reverse; }
.msg__avatar {
  width: 28px; height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--c-brand);
  color: #fff;
  font-size: 11px; font-weight: 700;
  display: grid; place-items: center;
}
.msg__col { display: flex; flex-direction: column; gap: 6px; max-width: 85%; }
.msg__bubble {
  display: inline-block;
  padding: 10px 14px;
  border-radius: 4px 12px 12px 12px;
  background: var(--c-ai-bubble);
  color: var(--c-text);
  font-size: 14px; line-height: 1.55;
  max-width: 100%;
  word-break: break-word;
}
.msg__bubble--user {
  background: var(--c-user-bubble);
  color: var(--c-brand-deep);
  border-radius: 12px 4px 12px 12px;
  font-weight: 500;
}

/* 打字指示器 */
.typing { display: inline-flex; gap: 4px; align-items: center; padding: 14px; }
.typing span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--c-sub);
  animation: blink 1.2s infinite ease-in-out;
}
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }

/* ---------- ② 引用与来源 ---------- */
.cite {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11px; font-weight: 600;
  color: var(--c-brand-deep);
  background: var(--c-chip-bg);
  border: 1px solid var(--c-chip-border);
  border-radius: 6px;
}
.cite :deep(.van-icon) { font-size: 13px; }
.cite__list {
  list-style: none;
  margin: 6px 0 0;
  padding: 8px 10px;
  background: var(--c-card);
  border-radius: 6px;
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

/* ---------- ③ 结构化产物 ---------- */
.product {
  margin-top: 8px;
  border-radius: 8px;
  background: var(--c-product-bg);
  border: 1px solid var(--c-product-border);
  overflow: hidden;
}
.product__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--c-chip-border);
}
.product__title { font-size: 13px; font-weight: 700; color: var(--c-brand-deep); }
.product__edit {
  font-size: 10px; font-weight: 600;
  color: var(--c-brand);
  background: #fff;
  padding: 2px 6px; border-radius: 4px;
}
.product__body { display: flex; gap: 8px; padding: 10px; }
/* 左：绿色时间轴子块 */
.timeline {
  flex-shrink: 0;
  padding: 8px 6px;
  background: var(--c-timeline-bg);
  border: 1px solid var(--c-timeline-border);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.timeline__item {
  display: flex; flex-direction: column; align-items: center;
  position: relative;
  padding: 4px 0;
}
.timeline__dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--c-timeline-dot);
}
.timeline__label { font-size: 9px; color: var(--c-timeline-dot); font-weight: 700; margin-top: 2px; }
.timeline__line {
  width: 1.5px; height: 12px;
  background: var(--c-timeline-border);
}
/* 右：文本行 */
.product__lines { list-style: none; flex: 1; min-width: 0; }
.product__lines li {
  display: flex; gap: 6px;
  padding: 3px 0;
  font-size: 12px;
}
.product__day { color: var(--c-brand-deep); font-weight: 700; flex-shrink: 0; }
.product__desc { color: var(--c-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.product__foot {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  font-size: 11px; color: var(--c-sub);
  background: rgba(255, 255, 255, 0.5);
}
.product__foot :deep(.van-icon) { color: var(--c-brand); font-size: 14px; }

/* ---------- ④ 消息操作条 ---------- */
.actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.actions__btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 8px;
  font-size: 11px; font-weight: 500;
  color: var(--c-sub);
  background: transparent;
  border: 1px solid var(--c-divider);
  border-radius: 4px;
}
.actions__btn :deep(.van-icon) { font-size: 12px; }
.actions__btn:active { color: var(--c-brand); border-color: var(--c-chip-border); }

/* ---------- ⑤ 建议芯片 ---------- */
.suggest {
  display: flex;
  gap: 8px;
  padding: 8px 12px 4px;
  overflow-x: auto;
  flex-shrink: 0;
}
.suggest::-webkit-scrollbar { display: none; }
.suggest__chip {
  flex-shrink: 0;
  padding: 6px 14px;
  font-size: 12.5px; font-weight: 500;
  color: var(--c-brand-deep);
  background: transparent;
  border: 1px solid var(--c-chip-border);
  border-radius: 16px;
  white-space: nowrap;
  transition: all 0.15s;
}
.suggest__chip:active { background: var(--c-chip-bg); }

/* ---------- ⑥ 输入条 ---------- */
.input {
  flex-shrink: 0;
  padding: 6px 12px calc(env(safe-area-inset-bottom) + 8px);
  background: var(--c-card);
  border-top: 1px solid var(--c-divider);
}
.input__toggles {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 10px;
  font-size: 11px; font-weight: 500;
  color: var(--c-sub);
  background: transparent;
  border: 1px solid var(--c-divider);
  border-radius: 12px;
  transition: all 0.15s;
}
.toggle :deep(.van-icon) { font-size: 13px; }
.toggle.is-on {
  color: var(--c-brand-deep);
  background: var(--c-chip-bg);
  border-color: var(--c-chip-border);
}
.input__row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.input__ic {
  width: 32px; height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid; place-items: center;
  color: var(--c-sub);
  background: var(--c-bg);
}
.input__ic :deep(.van-icon) { font-size: 18px; }
.input__field {
  flex: 1; min-width: 0;
  height: 36px;
  padding: 0 14px;
  font-size: 14px;
  color: var(--c-text);
  background: var(--c-bg);
  border: 1px solid var(--c-divider);
  border-radius: 18px;
  outline: none;
}
.input__field::placeholder { color: var(--c-sub); }
.input__send {
  width: 36px; height: 36px;
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
