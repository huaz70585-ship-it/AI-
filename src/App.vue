<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const active = ref(0)
const route = useRoute()
// 只有三个 Tab 落地页显示 tabbar：/（首页）、/trip（行程列表）、/profile（我的）
// /trip/:id（行程详情）、/chat（对话）、/message（消息）为全屏页，刻意隐藏
const showTabbar = computed(() =>
  ['/', '/trip', '/profile'].includes(route.path),
)
</script>

<template>
  <van-config-provider>
    <router-view />
    <van-tabbar v-if="showTabbar" v-model="active" route>
      <van-tabbar-item icon="home-o" to="/">首页</van-tabbar-item>
      <van-tabbar-item icon="calendar-o" to="/trip">行程</van-tabbar-item>
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
</style>
