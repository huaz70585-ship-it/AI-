import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  server: {
    // host: true = 监听全部网卡（IPv4 + IPv6 双栈，与后端 3001 一致）。
    // 不写时 Vite 默认只绑 [::1]（IPv6 回环）——浏览器走系统代理访问
    // 127.0.0.1:5175 时代理连不上 IPv4，回 502 upstream connect failed。
    host: true,
    port: 5175,
    proxy: {
      // /api 转发到后端（Express + SQLite，端口 3001）
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
