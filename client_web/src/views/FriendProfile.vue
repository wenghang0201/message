<template>
  <div class="friend-profile-view">
    <NavBar
      title="好友资料"
      left-arrow
      fixed
      @click-left="goBack"
    />

    <div v-if="loading" class="loading-container">
      <van-loading type="spinner" size="24">加载中...</van-loading>
    </div>

    <div v-else-if="profile" class="profile-content">
      <!-- Avatar and Basic Info -->
      <div class="profile-header">
        <van-image
          round
          width="80"
          height="80"
          :src="profile.avatarUrl || '/default-avatar.png'"
          class="profile-avatar"
        />
        <h2 class="profile-name">{{ profile.user?.username || '未知用户' }}</h2>
        <p v-if="profile.statusMessage" class="status-message">{{ profile.statusMessage }}</p>
      </div>

      <!-- Profile Information -->
      <van-cell-group inset class="info-group">
        <van-cell title="用户名" :value="profile.user?.username" />
        <van-cell title="邮箱" :value="profile.user?.email" />
        <van-cell v-if="profile.phoneNumber" title="电话" :value="profile.phoneNumber" />
        <van-cell v-if="profile.bio" title="个性签名" :value="profile.bio" />
      </van-cell-group>

      <!-- Actions -->
      <div class="action-buttons">
        <van-button
          type="primary"
          size="large"
          icon="chat-o"
          @click="handleStartChat"
        >
          发消息
        </van-button>
      </div>
    </div>

    <EmptyState
      v-else
      description="无法加载用户资料"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showNotify } from '@/utils/notify'
import { useChatStore } from '@/stores/chat'
import profileService from '@/services/profile.service'
import type { UserProfile } from '@/types/api'
import NavBar from '@/components/common/NavBar.vue'
import EmptyState from '@/components/common/EmptyState.vue'

interface Props {
  userId: string
}

const props = defineProps<Props>()
const router = useRouter()
const chatStore = useChatStore()

const loading = ref(true)
const profile = ref<UserProfile | null>(null)

const loadProfile = async () => {
  loading.value = true
  try {
    profile.value = await profileService.getUserProfile(props.userId)
  } catch (error: any) {
    showNotify({ type: 'danger', message: error.message || '加载资料失败' })
  } finally {
    loading.value = false
  }
}

const handleStartChat = async () => {
  try {
    const conversationId = await chatStore.createOrGetChat(props.userId)
    router.push({
      name: 'ChatDetail',
      params: { id: conversationId },
    })
  } catch (error: any) {
    showNotify({ type: 'danger', message: error.message || '创建聊天失败' })
  }
}

const goBack = () => {
  router.back()
}

onMounted(() => {
  loadProfile()
})
</script>

<style scoped>
.friend-profile-view {
  min-height: 100vh;
  background-color: #f7f8fa;
  padding-top: 46px;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.profile-content {
  padding: 20px 0;
}

.profile-header {
  text-align: center;
  padding: 30px 16px;
  background-color: #fff;
  margin-bottom: 10px;
}

.profile-avatar {
  margin-bottom: 16px;
}

.profile-name {
  font-size: 20px;
  font-weight: 600;
  color: #323233;
  margin: 0 0 8px 0;
}

.status-message {
  font-size: 14px;
  color: #969799;
  margin: 0;
}

.info-group {
  margin: 10px 0;
}

.action-buttons {
  padding: 20px 16px;
}

.action-buttons .van-button {
  width: 100%;
}
</style>
