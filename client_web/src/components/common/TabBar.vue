<template>
  <div class="tabbar-wrapper">
    <van-tabbar
      v-model="active"
      @change="handleChange"
      route
      :style="{
        maxWidth: appStore.show_width + 'px',
        left: '50%',
        transform: 'translateX(-50%)'
      }"
    >
      <van-tabbar-item to="/chats" icon="chat-o">
        聊天
        <template v-if="unreadCount > 0" #badge>
          <van-badge :content="unreadCount > 99 ? '99+' : unreadCount" />
        </template>
      </van-tabbar-item>
      <van-tabbar-item to="/friends" icon="friends-o">
        好友
        <template v-if="friendRequestCount > 0" #badge>
          <van-badge :content="friendRequestCount" />
        </template>
      </van-tabbar-item>
      <van-tabbar-item to="/profile" icon="user-o">
        我的
      </van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { useFriendStore } from '@/stores/friend'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const route = useRoute()
const chatStore = useChatStore()
const friendStore = useFriendStore()
const appStore = useAppStore()

const active = ref(0)

const unreadCount = computed(() => chatStore.totalUnreadCount)
const friendRequestCount = computed(() => friendStore.pendingRequests.length)

const handleChange = (index: number) => {
  const routes = ['/chats', '/friends', '/profile']
  router.push(routes[index])
}

// 根据当前路由设置活动标签
if (route.path.startsWith('/friends')) {
  active.value = 1
} else if (route.path.startsWith('/profile')) {
  active.value = 2
} else {
  active.value = 0
}
</script>

<style scoped>
.tabbar-wrapper {
  width: 100%;
}
</style>
