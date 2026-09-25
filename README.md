# 途灵 · 智能旅游助手

> **当前版本：V2**

移动端 H5 智能旅游规划助手。用户在对话中让 AI 规划行程，生成后落库为可调整的「时间轴 + 地图」行程，并按行程项实时重算预算与天气。

## 技术栈

- **前端**：Vue3 + VantUI4 + Vue Router + Pinia + Axios + Vite + SSE
- **后端**：Express + `node:sqlite`（内置，零依赖）+ JWT
- **AI**：DeepSeek（OpenAI 兼容格式，可经 `.env` 切换）
- **天气**：Open-Meteo（免费、无 Key）

## 目录

```
backend/    Express 后端（API + SQLite）
trval-h5/   前端 H5（Vue3 + Vant）
```

## 快速开始

```bash
# 后端（backend/ 下）
cp .env.example .env   # 填入 AI_API_KEY
npm install
npm run seed           # 初始化种子数据（4 城市 + 16 景点 + 示例行程）
npm run dev            # http://localhost:3001  (node --watch 热重载)

# 前端（trval-h5/ 下）
npm install
npm run dev            # http://localhost:5175  (Vite 代理 /api → 3001)
```

账号：`traveler / 123456`（管理员 `admin / 123456`）

## V2 新增

1. **AI 行程优化**：行程详情页底部「AI 调整」，输入一句口语要求（如「购物太多，换成亲子项目」），AI 重排整条行程并逐天落库、重新计算预算。
2. **存量数据回填**：`npm run backfill` 一键为历史行程按标题解析人均价（`price_ref`）、重算 `budget_total`、回填 `destination_id`。
3. **目的地稳定存储**：从行程标题解析内置城市写入 `destination_id`，让天气定位（Open-Meteo）优先命中，不再靠标题匹配。

## 关键规范

- 接口统一返回 `{ code, data, message }` 信封，非 0/200 触发 toast。
- 行程写操作带乐观锁 `If-Match: <revision>`，冲突返回 409。
- AI 输出的景点格式铁律：每个项目必须是 `名称（价格）`（免费写「免费」），前端据此后端按统一口径解析人均价、累加当日金额与总预算（成人权重 1，儿童 0.5）。
- 天气为锦上添花：定位失败 / 超出预报范围都不打扰用户，静默降级。

## 版本

- **V2**（当前）：AI 行程优化、数据回填、目的地存储、天气城市定位固化。
- **V1**：卡片信息流聊天、时间轴行程、乐观锁、预算随人数重算、Open-Meteo 天气接入。