<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const active = ref(0)
const route = useRoute()
const router = useRouter()
// Vant 组件主色引用 tokens 品牌层（CSS 变量经 ConfigProvider 内联后正常继承 :root），
// 避免 Vant 默认 #1989fa 与品牌色撞色
const themeVars = {
  '--van-primary-color': 'var(--c-brand)',
  '--van-text-color': '#1a1d21',
}
// 五个 Tab 落地页显示 tabbar：/（首页）、/trip（行程列表）、/message（消息）、/profile（我的）
// /trip/:id（行程详情）、/chat（对话）、/login（登录）为全屏页，刻意隐藏
const showTabbar = computed(() =>
  ['/', '/trip', '/message', '/profile'].includes(route.path),
)

// 中央 AI 凸起按钮 → 全屏对话页（产品唯一核心能力，占一级入口）
function goChat() {
  router.push('/chat')
}
</script>

<template>
  <van-config-provider :theme-vars="themeVars">
    <router-view />
    <van-tabbar v-if="showTabbar" v-model="active" route>
      <van-tabbar-item icon="home-o" to="/">首页</van-tabbar-item>
      <van-tabbar-item icon="calendar-o" to="/trip">行程</van-tabbar-item>
      <!-- 中央凸起 AI 按钮：占据一格（flex:1 与 tabbar-item 同宽），圆钮上凸出栏 -->
      <div class="tabbar-ai" role="button" aria-label="AI 规划" @click="goChat">
        <span class="tabbar-ai__btn">
          <!-- 灵光星：与 logo / 首页搜索框同一符号，全站 AI = 这颗星 -->
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3l1.9 5.6a1 1 0 0 0 .63.63L20.2 11l-5.67 1.77a1 1 0 0 0-.63.63L12 19l-1.9-5.6a1 1 0 0 0-.63-.63L3.8 11l5.67-1.77a1 1 0 0 0 .63-.63L12 3Z" fill="currentColor"/>
          </svg>
        </span>
        <span class="tabbar-ai__label">AI</span>
      </div>
      <van-tabbar-item icon="chat-o" to="/message">消息</van-tabbar-item>
      <van-tabbar-item icon="contact-o" to="/profile">我的</van-tabbar-item>
    </van-tabbar>
  </van-config-provider>
</template>

<style>
/* 底栏与滚动内容的视觉分隔。
   Vant 的 van-tabbar 默认是无上边框的纯白平板，而页面卡片同为纯白 #fff：
   滚动时白卡贴上白栏边界消失，看起来内容从底栏后面"穿透"（行程列表页最明显）。
   用 --c-divider 细线 + 极轻上投影建立边界；阴影色取自 --c-text 的 rgb。 */
.van-tabbar {
  border-top: 1px solid var(--c-divider);
  box-shadow: 0 -2px 8px rgba(26, 29, 33, 0.04);
}

/* ---------- 中央 AI 凸起按钮 ---------- */
/* 与 van-tabbar-item 同占一格（flex:1），圆钮以负 margin 凸出栏外 */
.tabbar-ai {
  position: relative;
  z-index: 1; /* 压过 van-tabbar 自带的 ::after 顶部 hairline——它按树序画在所有子元素之上 */
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
/* 分隔线遮罩：底栏 border-top 会穿过圆钮的白描边环，视觉上像把圆"切开"。
   在按钮正下方垫一块与底栏同色的补丁（::before 先于子元素绘制，圆钮盖在它上面），
   让分隔线在圆钮轮廓前干净断开 */
.tabbar-ai::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -4px;
  transform: translateX(-50%);
  width: 58px;
  height: 12px;
  background: #fff; /* 与 van-tabbar 底色一致 */
}
.tabbar-ai__btn {
  position: relative;
  width: 46px;
  height: 46px;
  margin-top: -20px;                 /* 凸出栏顶：Vant tabbar 高 50px，凸出约 2/3 */
  border-radius: 50%;
  background: var(--c-brand);
  color: #fff;
  display: grid;
  place-items: center;
  border: 3px solid #fff;            /* 白描边裁开底栏边界线，凸起更清晰 */
  box-shadow: var(--glow-btn);       /* 下投影 + 近距品牌青光晕（tokens.css 里与搜索框共用同一份） */
  transition: transform 0.15s var(--ease-motion, ease);
}
/* 呼吸光晕：独立伪元素只动 opacity（GPU 安全），blur 收在 18px 内不远处 */
.tabbar-ai__btn::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  box-shadow: var(--glow-halo);
  animation: glow-breathe 2.8s var(--ease-motion) infinite; /* 动效本体在 tokens.css（全局） */
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .tabbar-ai__btn::before { animation: none; }
}
.tabbar-ai__btn:active { transform: scale(0.92); }
.tabbar-ai__btn svg { width: 22px; height: 22px; }
.tabbar-ai__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-sub);
  line-height: 1;
}
</style>
