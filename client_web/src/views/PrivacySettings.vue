<template>
  <div class="privacy-settings-view">
    <NavBar
      title="隐私设置"
      left-arrow
      fixed
      @click-left="goBack"
    />

    <div class="privacy-content">
      <van-cell-group inset>
        <van-cell
          title="谁可以看到我的最后在线时间"
          is-link
          :value="lastSeenLabel"
          @click="showLastSeenPicker = true"
        />
      </van-cell-group>

      <div class="privacy-description">
        <p>控制谁可以看到你的在线状态和最后在线时间。</p>
        <ul>
          <li><strong>所有人：</strong>所有能看到你的人都可以看到</li>
          <li><strong>不公开：</strong>没有人可以看到</li>
        </ul>
      </div>
    </div>

    <!-- Last Seen Picker -->
    <van-action-sheet
      v-model:show="showLastSeenPicker"
      :actions="privacyActions"
      cancel-text="取消"
      close-on-click-action
      @select="onLastSeenSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showLoadingToast, closeToast } from 'vant'
import { showNotify } from '@/utils/notify'
import profileService from '@/services/profile.service'
import NavBar from '@/components/common/NavBar.vue'

type PrivacyLevel = 'everyone' | 'nobody'

const router = useRouter()

const showLastSeenPicker = ref(false)

const showLastSeen = ref<PrivacyLevel>('everyone')

const privacyActions = [
  { name: '所有人', value: 'everyone' },
  { name: '不公开', value: 'nobody' },
]

const lastSeenLabel = computed(() => {
  const action = privacyActions.find(a => a.value === showLastSeen.value)
  return action?.name || '所有人'
})

onMounted(async () => {
  await loadPrivacySettings()
})

const loadPrivacySettings = async () => {
  try {
    const profile = await profileService.getMyProfile()
    if (profile.privacySettings) {
      showLastSeen.value = profile.privacySettings.showLastSeen || 'everyone'
    }
  } catch (error) {
    showNotify({
      type: 'danger',
      message: '加载隐私设置失败',
    })
  }
}

const onLastSeenSelect = async (action: { name: string; value: string }) => {
  try {
    showLoadingToast({
      message: '保存中...',
      forbidClick: true,
      duration: 0,
    })

    await profileService.updatePrivacySettings({
      showLastSeen: action.value as PrivacyLevel,
    })

    // 更新本地状态
    showLastSeen.value = action.value as PrivacyLevel

    closeToast()
    showNotify({
      type: 'success',
      message: '隐私设置已更新',
    })
  } catch (error) {
    closeToast()
    showNotify({
      type: 'danger',
      message: '更新失败，请重试',
    })
  }
}

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.privacy-settings-view {
  min-height: 100dvh;
  background-color: var(--van-background-2);
  padding-top: 46px;
}

.privacy-content {
  padding: 16px 0;
}

.privacy-description {
  padding: 20px 24px;
  color: var(--van-text-color-2);
  font-size: 14px;
  line-height: 1.6;
}

.privacy-description p {
  margin-bottom: 12px;
}

.privacy-description ul {
  margin: 0;
  padding-left: 20px;
}

.privacy-description li {
  margin-bottom: 8px;
}

.privacy-description strong {
  color: var(--van-text-color);
}
</style>
