<template>
  <div class="edit-profile-view">
    <NavBar
      title="编辑资料"
      left-arrow
      fixed
      @click-left="handleCancel"
    >
      <template #right>
        <van-button
          type="primary"
          size="small"
          :loading="saving"
          @click="handleSave"
        >
          保存
        </van-button>
      </template>
    </NavBar>

    <div class="edit-profile-content">
      <van-loading v-if="loading" class="loading-indicator">
        加载中...
      </van-loading>

      <template v-else>
        <!-- Avatar Section -->
        <van-cell-group inset title="头像">
          <van-cell center>
            <template #icon>
              <div class="avatar-upload">
                <van-uploader
                  v-model="avatarFile"
                  :max-count="1"
                  :preview-image="false"
                  :after-read="handleAvatarUpload"
                >
                  <van-image
                    round
                    width="80"
                    height="80"
                    :src="avatarPreview || '/default-avatar.png'"
                    fit="cover"
                  />
                  <div class="upload-overlay">
                    <van-icon name="photograph" size="24" />
                  </div>
                </van-uploader>
              </div>
            </template>
          </van-cell>
        </van-cell-group>

        <!-- Profile Information -->
        <van-cell-group inset title="个人信息">
          <van-field
            v-model="formData.bio"
            label="个性签名"
            type="textarea"
            placeholder="介绍一下自己吧"
            rows="3"
            maxlength="500"
            show-word-limit
            autosize
          />
          <van-field
            v-model="formData.phoneNumber"
            label="手机号码"
            type="tel"
            placeholder="请输入手机号码"
            maxlength="20"
          />
          <van-field
            v-model="formData.statusMessage"
            label="状态"
            placeholder="设置你的状态"
            maxlength="100"
            show-word-limit
          />
        </van-cell-group>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showLoadingToast, closeToast, showNotify } from 'vant'
import type { UploaderFileListItem } from 'vant'
import NavBar from '@/components/common/NavBar.vue'
import profileService from '@/services/profile.service'
import uploadService from '@/services/upload.service'
import type { UserProfile, UpdateProfileDto } from '@/types/api'

const router = useRouter()

// 状态
const loading = ref(false)
const saving = ref(false)
const avatarFile = ref<UploaderFileListItem[]>([])
const avatarPreview = ref<string | null>(null)
const originalProfile = ref<UserProfile | null>(null)
// 跟踪 blob URL 以便清理
const blobUrls = ref<Set<string>>(new Set())

// 表单数据
const formData = reactive<UpdateProfileDto>({
  avatarUrl: undefined,
  bio: undefined,
  phoneNumber: undefined,
  statusMessage: undefined,
})

// 生命周期
onMounted(async () => {
  await loadProfile()
})

// 卸载时清理 blob URL
onBeforeUnmount(() => {
  blobUrls.value.forEach(url => URL.revokeObjectURL(url))
  blobUrls.value.clear()
})

// 方法
const loadProfile = async () => {
  loading.value = true
  try {
    const profile = await profileService.getMyProfile()
    originalProfile.value = profile

    // 填充表单数据
    formData.avatarUrl = profile.avatarUrl || undefined
    formData.bio = profile.bio || undefined
    formData.phoneNumber = profile.phoneNumber || undefined
    formData.statusMessage = profile.statusMessage || undefined

    // 设置头像预览
    avatarPreview.value = profile.avatarUrl
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.message || '加载资料失败',
    })
  } finally {
    loading.value = false
  }
}

const handleAvatarUpload = async (fileOrFiles: UploaderFileListItem | UploaderFileListItem[]) => {
  try {
    // 处理单个文件或文件数组
    const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles
    if (!file) return

    // 使用对象 URL 显示即时本地预览
    if (file.file) {
      const blobUrl = URL.createObjectURL(file.file)
      blobUrls.value.add(blobUrl)
      avatarPreview.value = blobUrl
    }

    showLoadingToast({
      message: '上传中...',
      forbidClick: true,
      duration: 0,
    })

    // 上传文件到服务器
    const fileUrl = await uploadService.uploadFile(file.file as File, (progress) => {
      showLoadingToast({
        message: `上传中 ${progress}%`,
        forbidClick: true,
        duration: 0,
      })
    })

    closeToast()

    // 使用服务器 URL 和表单数据更新预览
    // 由于现在有服务器 URL，撤销旧的 blob URL
    if (avatarPreview.value && blobUrls.value.has(avatarPreview.value)) {
      URL.revokeObjectURL(avatarPreview.value)
      blobUrls.value.delete(avatarPreview.value)
    }
    avatarPreview.value = fileUrl
    formData.avatarUrl = fileUrl

    // 显示成功通知前稍作延迟以改善用户体验
    setTimeout(() => {
      showNotify({
        type: 'success',
        message: '头像上传成功',
      })
    }, 100)
  } catch (error: any) {
    closeToast()
    setTimeout(() => {
      showNotify({
        type: 'danger',
        message: error.message || '头像上传失败',
      })
    }, 100)
  }
}

const handleSave = async () => {
  // 如果提供则验证电话号码格式
  if (formData.phoneNumber && !/^[0-9+\-\s()]*$/.test(formData.phoneNumber)) {
    showNotify({
      type: 'warning',
      message: '手机号码格式不正确',
    })
    return
  }

  saving.value = true
  try {
    // 更新资料
    await profileService.updateMyProfile(formData)

    showNotify({
      type: 'success',
      message: '资料已更新',
    })

    // 短暂延迟后返回
    setTimeout(() => {
      router.back()
    }, 500)
  } catch (error: any) {
    showNotify({
      type: 'danger',
      message: error.message || '更新资料失败',
    })
  } finally {
    saving.value = false
  }
}

const handleCancel = () => {
  // 检查表单是否有更改
  const hasChanges =
    formData.avatarUrl !== originalProfile.value?.avatarUrl ||
    formData.bio !== originalProfile.value?.bio ||
    formData.phoneNumber !== originalProfile.value?.phoneNumber ||
    formData.statusMessage !== originalProfile.value?.statusMessage

  if (hasChanges) {
    showDialog({
      title: '放弃更改',
      message: '确定要放弃所做的更改吗？',
      showCancelButton: true,
      confirmButtonText: '放弃',
      cancelButtonText: '取消',
      confirmButtonColor: '#ee0a24',
    }).then(() => {
      router.back()
    }).catch(() => {
      // 用户取消
    })
  } else {
    router.back()
  }
}
</script>

<style scoped>
.edit-profile-view {
  min-height: 100dvh;
  background-color: var(--van-background-2);
}

.edit-profile-content {
  padding: 56px 0 20px;
}

.loading-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
}

.avatar-upload {
  position: relative;
  margin-right: 16px;
}

.upload-overlay {
  position: absolute;
  bottom: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

:deep(.van-cell-group__title) {
  padding-left: 16px;
}
</style>
