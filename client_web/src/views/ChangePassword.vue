<template>
  <div class="change-password-view">
    <NavBar
      title="修改密码"
      left-arrow
      fixed
      @click-left="goBack"
    />

    <div class="change-password-content">
      <van-form @submit="handleSubmit">
        <van-cell-group inset>
          <van-field
            v-model="formData.currentPassword"
            type="password"
            name="currentPassword"
            label="当前密码"
            placeholder="请输入当前密码"
            :rules="[{ required: true, message: '请输入当前密码' }]"
          />
          <van-field
            v-model="formData.newPassword"
            type="password"
            name="newPassword"
            label="新密码"
            placeholder="请输入新密码（至少6位）"
            :rules="[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' }
            ]"
          />
          <van-field
            v-model="formData.confirmPassword"
            type="password"
            name="confirmPassword"
            label="确认密码"
            placeholder="请再次输入新密码"
            :rules="[
              { required: true, message: '请再次输入新密码' },
              { validator: validateConfirmPassword, message: '两次输入的密码不一致' }
            ]"
          />
        </van-cell-group>

        <div class="submit-button">
          <van-button
            round
            block
            type="primary"
            native-type="submit"
            :loading="submitting"
          >
            确认修改
          </van-button>
        </div>
      </van-form>

      <div class="password-tips">
        <p class="tips-title">密码安全提示：</p>
        <ul>
          <li>密码长度至少6位</li>
          <li>建议使用字母、数字和特殊字符的组合</li>
          <li>不要使用过于简单的密码</li>
          <li>定期更换密码以保护账号安全</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showNotify } from '@/utils/notify'
import authService from '@/services/auth.service'
import NavBar from '@/components/common/NavBar.vue'

const router = useRouter()

const submitting = ref(false)

const formData = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const validateConfirmPassword = (value: string) => {
  return value === formData.newPassword
}

const handleSubmit = async () => {
  if (formData.newPassword !== formData.confirmPassword) {
    showNotify({
      type: 'warning',
      message: '两次输入的密码不一致',
    })
    return
  }

  if (formData.newPassword.length < 6) {
    showNotify({
      type: 'warning',
      message: '密码至少6位',
    })
    return
  }

  submitting.value = true
  try {
    await authService.changePassword(formData.currentPassword, formData.newPassword)

    showNotify({
      type: 'success',
      message: '密码修改成功',
    })

    // 短暂延迟后返回
    setTimeout(() => {
      router.back()
    }, 1000)
  } catch (error: any) {
    const errorMessage = error.response?.data?.error?.message || error.message || '密码修改失败，请检查当前密码是否正确'
    showNotify({
      type: 'danger',
      message: errorMessage,
    })
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.change-password-view {
  min-height: 100dvh;
  background-color: var(--van-background-2);
  padding-top: 46px;
}

.change-password-content {
  padding: 16px 0;
}

.submit-button {
  padding: 24px 16px;
}

.password-tips {
  padding: 20px 24px;
  color: var(--van-text-color-2);
  font-size: 13px;
  line-height: 1.6;
}

.tips-title {
  font-weight: 500;
  color: var(--van-text-color);
  margin-bottom: 8px;
}

.password-tips ul {
  margin: 0;
  padding-left: 20px;
}

.password-tips li {
  margin-bottom: 6px;
}
</style>
