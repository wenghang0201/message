<template>
  <div
    id="app"
    :style="{
      width: appStore.show_width + 'px',
      marginLeft: Math.max(0, (appStore.width - appStore.show_width) / 2) + 'px'
    }"
  >
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from 'vue'
import { useAppStore } from './stores/app'
import { useAuthStore } from './stores/auth'
import websocketService from './services/websocket.service'

const appStore = useAppStore()
const authStore = useAuthStore()

const updateDimensions = () => {
  appStore.changeSize(window.innerWidth, window.innerHeight)
}

onMounted(() => {
  updateDimensions()
  window.addEventListener('resize', updateDimensions)

  // 如果用户已认证则连接 WebSocket
  if (authStore.isAuthenticated) {
    websocketService.connect()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateDimensions)
  websocketService.disconnect()
})

// 监听认证状态变化
watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated) {
    websocketService.connect()
  } else {
    websocketService.disconnect()
  }
})
</script>

<style scoped>
#app {
  height: 100dvh;
  background-color: var(--chat-background, #f7f8fa);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
