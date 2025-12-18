<template>
  <div class="navbar-wrapper">
    <div class="navbar-placeholder" v-if="fixed"></div>
    <div
      class="navbar"
      :class="{ fixed }"
      :style="{
        maxWidth: appStore.show_width + 'px',
        left: fixed ? '50%' : 'auto',
        transform: fixed ? 'translateX(-50%)' : 'none'
      }"
    >
      <div class="navbar-content">
        <!-- 左侧区域 -->
        <div class="navbar-left">
          <van-icon
            v-if="leftArrow"
            name="arrow-left"
            size="20"
            @click="handleLeftClick"
            class="navbar-icon"
          />
          <slot name="left"></slot>
        </div>

        <!-- 标题区域 -->
        <div class="navbar-title">
          <slot name="title">{{ title }}</slot>
        </div>

        <!-- 右侧区域 -->
        <div class="navbar-right">
          <slot name="right"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/app'

interface Props {
  title?: string
  leftArrow?: boolean
  fixed?: boolean
}

withDefaults(defineProps<Props>(), {
  title: '',
  leftArrow: false,
  fixed: false,
})

const emit = defineEmits<{
  clickLeft: []
}>()

const appStore = useAppStore()

const handleLeftClick = () => {
  emit('clickLeft')
}
</script>

<style scoped>
.navbar-wrapper {
  width: 100%;
}

.navbar-placeholder {
  height: 46px;
}

.navbar {
  width: 100%;
  background-color: var(--van-background-2, #fff);
  border-bottom: 1px solid var(--van-border-color, #ebedf0);
  z-index: 100;
}

.navbar.fixed {
  position: fixed;
  top: 0;
}

.navbar-content {
  display: flex;
  align-items: center;
  height: 46px;
  padding: 0 16px;
  max-width: 100%;
  margin: 0 auto;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.navbar-icon {
  cursor: pointer;
  color: var(--van-text-color, #323233);
  transition: opacity 0.2s;
}

.navbar-icon:active {
  opacity: 0.6;
}

.navbar-title {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--van-text-color, #323233);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 16px;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style>
