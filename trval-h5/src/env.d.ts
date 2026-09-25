/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 腾讯地图 GL JS 的 Key（在 lbs.qq.com 腾讯位置服务开放平台申请）。
   * 未配置时行程页「地图」Tab 显示引导文案，不影响其它功能。
   * 建议写在 `trval-h5/.env.local`（已被 git 忽略），不要提交到仓库。
   */
  readonly VITE_TMAP_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
