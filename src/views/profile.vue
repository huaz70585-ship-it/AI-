<template>
  <div class="profile">
    <!-- Hero · 蓝色渐变主角区（全页唯一大色块） -->
    <header class="hero">
      <div class="hero__inner">
        <div class="hero__user">
          <div class="hero__avatar">
            <van-icon name="user-o" />
          </div>
          <div class="hero__info">
            <h1 class="hero__name">陆行的旅行簿</h1>
            <div class="hero__tags">
              <span class="hero__tag">探索者 Lv.4</span>
              <span class="hero__tag">已解锁 12 城</span>
            </div>
          </div>
        </div>
        <button class="hero__edit" aria-label="编辑资料">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2.5l1.6 4.6 4.6 1.6-4.6 1.6L12 14.9l-1.6-4.6L5.8 8.7l4.6-1.6L12 2.5Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- 足迹卡 · 主角（白卡压在 hero 上） -->
    <section class="tracks">
      <div class="tracks__head">
        <span class="tracks__title">我的足迹</span>
        <button class="tracks__link">足迹地图 <van-icon name="arrow" /></button>
      </div>
      <div class="tracks__stats">
        <div class="stat">
          <span class="stat__num">12</span>
          <span class="stat__label">到访城市</span>
        </div>
        <span class="stat__sep"></span>
        <div class="stat">
          <span class="stat__num">46</span>
          <span class="stat__label">旅行天数</span>
        </div>
        <span class="stat__sep"></span>
        <div class="stat">
          <span class="stat__num">8,240</span>
          <span class="stat__label">累计公里</span>
        </div>
      </div>
      <div class="tracks__progress">
        <span
          v-for="i in 10"
          :key="i"
          class="tracks__dot"
          :class="{ 'is-on': i <= 7 }"
        ></span>
      </div>
    </section>

    <!-- 我的行程（AI 落点：状态展示，不加新入口） -->
    <section class="block">
      <div class="block__head">
        <h3 class="block__title">我的行程</h3>
        <button class="block__more" @click="router.push('/trip')">
          全部 5 个 <van-icon name="arrow" />
        </button>
      </div>

      <article class="trip" @click="router.push('/trip/t1')">
        <div class="trip__body">
          <p class="trip__route">上海 · 4日</p>
          <p class="trip__meta">10.12 - 10.15 · 2人</p>
          <span class="trip__ai">
            <van-icon name="medal-o" /> AI 已优化行程
          </span>
        </div>
        <div class="trip__media">
          <img :src="tripImage" alt="" class="trip__img" />
          <div class="trip__overlay"></div>
          <span class="trip__badge">3天后出发</span>
        </div>
      </article>
    </section>

    <!-- 快捷入口 · 4 个高频（不做更多折叠） -->
    <section class="actions">
      <button class="action">
        <span class="action__ic">
          <van-icon name="balance-list-o" />
          <span class="action__dot"></span>
        </span>
        <span class="action__label">我的订单</span>
      </button>
      <button class="action">
        <span class="action__ic"><van-icon name="like-o" /></span>
        <span class="action__label">我的收藏</span>
      </button>
      <button class="action">
        <span class="action__ic"><van-icon name="coupon-o" /></span>
        <span class="action__label">优惠券</span>
      </button>
      <button class="action">
        <span class="action__ic"><van-icon name="photo-o" /></span>
        <span class="action__label">旅行相册</span>
      </button>
    </section>

    <!-- 设置列表 -->
    <section class="settings">
      <van-cell-group :border="false" inset>
        <van-cell title="帮助与客服" icon="service-o" is-link size="large" />
        <van-cell title="意见反馈" icon="comment-o" is-link size="large" />
        <van-cell title="通用设置" icon="setting-o" is-link size="large" />
        <van-cell title="关于我们" icon="info-o" is-link size="large" />
      </van-cell-group>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

// 行程封面图（本页唯一照片 · 压字加渐变遮罩）
const tripImage =
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' +
  encodeURIComponent('上海外滩夜景 城市天际线 旅行摄影 暖光') +
  '&image_size=landscape_4_3'
</script>

<style scoped>
/* 与首页 / 对话页共用三层体系 */
.profile {
  /* 颜色与字体 token 统一在 src/styles/tokens.css（:root），此处不再声明 */

  min-height: 100vh;
  min-height: 100dvh;
  background: var(--c-bg);
  color: var(--c-text);
  padding-bottom: 72px; /* tabbar */
  font-family: var(--font-sans);
}

/* ---------- Hero ---------- */
.hero {
  background: linear-gradient(160deg, var(--c-brand-deep) 0%, var(--c-brand) 100%);
  padding: calc(env(safe-area-inset-top) + 24px) 20px 44px;
  border-radius: 0 0 24px 24px;
}
.hero__inner {
  display: flex;
  align-items: center;
  gap: 14px;
}
.hero__user { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
.hero__avatar {
  width: 54px; height: 54px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  display: grid; place-items: center;
  color: #fff;
}
.hero__avatar :deep(.van-icon) { font-size: 28px; }
.hero__info { min-width: 0; }
.hero__name {
  font-size: 19px; font-weight: 700;
  color: #fff; letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hero__tags { display: flex; gap: 6px; margin-top: 6px; }
.hero__tag {
  font-size: 11px; font-weight: 600;
  color: #fff;
  background: rgba(255, 255, 255, 0.18);
  padding: 2px 8px;
  border-radius: 8px;
}
.hero__edit {
  width: 36px; height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  display: grid; place-items: center;
  color: #fff;
}
.hero__edit svg { width: 18px; height: 18px; }

/* ---------- 足迹卡（压在 hero 上） ---------- */
.tracks {
  margin: -28px 16px 0;
  position: relative;
  background: var(--c-card);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 6px 20px rgba(10, 26, 43, 0.08);
}
.tracks__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.tracks__title { font-size: 15px; font-weight: 700; }
.tracks__link {
  display: inline-flex; align-items: center; gap: 2px;
  font-size: 11.5px; color: var(--c-sub);
}
.tracks__link :deep(.van-icon) { font-size: 12px; }
.tracks__stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stat__num { font-size: 24px; font-weight: 800; color: var(--c-brand); line-height: 1; letter-spacing: -0.02em; }
.stat__label { font-size: 11px; color: var(--c-sub); }
.stat__sep { width: 1px; height: 28px; background: var(--c-divider); }
.tracks__progress { display: flex; gap: 6px; justify-content: center; margin-top: 14px; }
.tracks__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--c-divider);
}
.tracks__dot.is-on { background: var(--c-brand); }

/* ---------- 通用 block ---------- */
.block { margin: 20px 16px 0; }
.block__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.block__title { font-size: 15px; font-weight: 700; }
.block__more {
  display: inline-flex; align-items: center; gap: 2px;
  font-size: 12px; color: var(--c-sub);
}
.block__more :deep(.van-icon) { font-size: 12px; }

/* ---------- 行程卡（AI 状态展示） ---------- */
.trip {
  display: flex;
  gap: 12px;
  align-items: stretch;
  background: var(--c-card);
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(10, 26, 43, 0.05);
}
.trip__body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.trip__route { font-size: 16px; font-weight: 700; color: var(--c-text); }
.trip__meta { font-size: 12px; color: var(--c-sub); margin-top: 4px; }
.trip__ai {
  margin-top: auto;
  display: inline-flex; align-items: center; gap: 3px;
  align-self: flex-start;
  font-size: 11px; font-weight: 600;
  color: var(--c-brand-deep);
  background: var(--c-brand-soft);
  padding: 3px 8px;
  border-radius: 6px;
}
.trip__ai :deep(.van-icon) { font-size: 12px; }
.trip__media {
  position: relative;
  width: 96px; flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: var(--c-divider);
}
.trip__img { width: 100%; height: 100%; object-fit: cover; display: block; }
.trip__overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(10, 74, 138, 0.55) 100%);
}
.trip__badge {
  position: absolute; top: 6px; left: 6px;
  font-size: 10px; font-weight: 700;
  color: #fff;
  background: var(--c-brand);
  padding: 2px 6px;
  border-radius: 4px;
}

/* ---------- 快捷入口 4 ---------- */
.actions {
  margin: 20px 16px 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--c-card);
  border-radius: 14px;
  padding: 14px 0;
  box-shadow: 0 2px 8px rgba(10, 26, 43, 0.05);
}
.action {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  color: var(--c-text);
}
.action__ic {
  width: 40px; height: 40px;
  border-radius: 12px;
  display: grid; place-items: center;
  color: var(--c-brand);
  background: var(--c-brand-soft);
  position: relative;
}
.action__ic :deep(.van-icon) { font-size: 22px; }
.action__dot {
  position: absolute; top: 8px; right: 8px;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--c-accent);   /* 暖橙 <5%：仅订单红点 */
  border: 1.5px solid var(--c-card);
}
.action__label { font-size: 11.5px; color: var(--c-sub); }

/* ---------- 设置列表 ---------- */
.settings { margin: 20px 16px 0; }
.settings :deep(.van-cell-group--inset) {
  margin: 0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(10, 26, 43, 0.05);
}
.settings :deep(.van-cell) {
  padding: 14px 16px;
  font-size: 14px;
}
.settings :deep(.van-cell__title) { color: var(--c-text); font-weight: 500; }
.settings :deep(.van-cell__left-icon) {
  font-size: 20px;
  color: var(--c-sub);
  margin-right: 12px;
}
.settings :deep(.van-cell__right-icon) { color: var(--c-divider); }
.settings :deep(.van-cell::after) { border-color: var(--c-divider); }
</style>
