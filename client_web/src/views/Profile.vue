<template>
  <div class="profile-view">
    <NavBar
      title="我的"
      fixed
    />

    <div class="profile-content">
      <!-- User Info Card -->
      <van-cell-group inset>
        <van-cell center>
          <template #icon>
            <van-image
              round
              width="60"
              height="60"
              :src="profile?.avatarUrl || '/default-avatar.png'"
              class="profile-avatar"
            />
          </template>
          <template #title>
            <div class="profile-name">{{ authStore.user?.username || '用户' }}</div>
          </template>
          <template #label>
            <div class="profile-email">{{ authStore.user?.email || '未设置邮箱' }}</div>
            <div v-if="profile?.statusMessage" class="profile-status">{{ profile.statusMessage }}</div>
          </template>
        </van-cell>
        <van-cell v-if="profile?.bio" title="个性签名">
          <template #default>
            <div class="bio-text">{{ profile.bio }}</div>
          </template>
        </van-cell>
        <van-cell v-if="profile?.phoneNumber" title="手机号码" :value="profile.phoneNumber" />
      </van-cell-group>

      <!-- Settings -->
      <van-cell-group inset title="设置">
        <van-cell
          title="编辑资料"
          is-link
          @click="handleEditProfile"
        />
        <van-cell
          title="隐私设置"
          is-link
          @click="handlePrivacySettings"
        />
        <van-cell
          title="修改密码"
          is-link
          @click="handleChangePassword"
        />
      </van-cell-group>

      <!-- About -->
      <van-cell-group inset title="关于">
        <van-cell title="版本" value="1.0.0" />
      </van-cell-group>

      <!-- Logout Button -->
      <div class="logout-section">
        <van-button
          block
          type="danger"
          :loading="isLoggingOut"
          @click="handleLogout"
        >
          退出登录
        </van-button>
      </div>
    </div>

    <TabBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showNotify } from 'vant'
import { useAuthStore } from '@/stores/auth'
import profileService from '@/services/profile.service'
import type { UserProfile } from '@/types/api'
import NavBar from '@/components/common/NavBar.vue'
import TabBar from '@/components/common/TabBar.vue'

const router = useRouter()
const authStore = useAuthStore()

const isLoggingOut = ref(false)
const profile = ref<UserProfile | null>(null)

onMounted(async () => {
  await loadProfile()
})

const loadProfile = async () => {
  try {
    profile.value = await profileService.getMyProfile()
  } catch (error) {
    // 静默失败 - 用户仍然可以从 authStore 看到基本信息
  }
}

const handleEditProfile = () => {
  router.push('/edit-profile')
}

const handlePrivacySettings = () => {
  router.push('/privacy-settings')
}

const handleChangePassword = () => {
  router.push('/change-password')
}

const handleLogout = () => {
  showDialog({
    title: '退出登录',
    message: '确定要退出登录吗？',
    showCancelButton: true,
    confirmButtonText: '退出',
    cancelButtonText: '取消',
    confirmButtonColor: '#ee0a24',
  }).then(async () => {
    try {
      isLoggingOut.value = true
      await authStore.logout()

      showNotify({
        type: 'success',
        message: '已退出登录',
      })

      // 重定向到登录页
      router.replace('/login')
    } catch (error) {
      showNotify({
        type: 'danger',
        message: '退出登录失败',
      })
    } finally {
      isLoggingOut.value = false
    }
  }).catch(() => {
    // 用户取消
  })
}
</script>

<style scoped>
.profile-view {
  height: 100dvh;
  background-color: var(--van-background-2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.profile-content {
  padding: 56px 0 20px;
}

.profile-avatar {
  margin-right: 16px;
}

.profile-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--van-text-color);
  margin-bottom: 4px;
}

.profile-email {
  font-size: 14px;
  color: var(--van-text-color-2);
}

.profile-status {
  font-size: 13px;
  color: var(--van-text-color-3);
  margin-top: 4px;
  font-style: italic;
}

.bio-text {
  font-size: 14px;
  color: var(--van-text-color-2);
  line-height: 1.6;
  white-space: pre-wrap;
}

.logout-section {
  padding: 24px 16px;
}

:deep(.van-cell-group__title) {
  padding-left: 16px;
}
</style>
