<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const active = ref(0)
const route = useRoute()
// 仅 /chat 对话为全屏页隐藏 tabbar；行程等 tab 保留底部导航
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
