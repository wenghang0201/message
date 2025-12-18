<template>
  <div class="login-container">
    <div class="login-header">
      <h1>欢迎回来</h1>
      <p>登录您的账户</p>
    </div>

    <van-form @submit="handleLogin">
      <van-cell-group inset>
        <van-field
          v-model="formData.usernameOrEmail"
          name="usernameOrEmail"
          label="用户名/邮箱"
          placeholder="请输入用户名或邮箱"
          :rules="[{ required: true, message: '请输入用户名或邮箱' }]"
          clearable
        />
        <van-field
          v-model="formData.password"
          type="password"
          name="password"
          label="密码"
          placeholder="请输入密码"
          :rules="[{ required: true, message: '请输入密码' }]"
          clearable
        />
      </van-cell-group>

      <div class="login-actions">
        <van-button
          round
          block
          type="primary"
          native-type="submit"
          :loading="authStore.isLoading"
          :disabled="authStore.isLoading"
        >
          登录
        </van-button>

        <div class="register-link">
          <span>还没有账户？</span>
          <van-button type="primary" text="true" @click="goToRegister">
            立即注册
          </van-button>
        </div>
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showNotify } from 'vant';
import { useAuthStore } from '@/stores/auth';
import type { LoginDto } from '@/types/api';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const formData = reactive<LoginDto>({
  usernameOrEmail: '',
  password: '',
});

async function handleLogin() {
  try {
    await authStore.login(formData);

    showNotify({
      type: 'success',
      message: '登录成功',
    });

    const redirect = (route.query.redirect as string) || '/chats';
    router.replace(redirect);
  } catch (err: any) {
    showNotify({
      type: 'danger',
      message: err.response?.data?.message || '登录失败，请检查用户名和密码',
    });
  }
}

function goToRegister() {
  router.push('/register');
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  padding: 60px 16px 16px;
  background: var(--van-background-2);
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
  color: var(--van-text-color);
}

.login-header h1 {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--van-primary-color);
}

.login-header p {
  font-size: 16px;
  color: var(--van-text-color-2);
}

.login-actions {
  margin-top: 24px;
  padding: 0 16px;
}

.login-actions .van-button {
  margin-bottom: 16px;
}

.register-link {
  text-align: center;
  color: var(--van-text-color-2);
  font-size: 14px;
}

.register-link span {
  margin-right: 8px;
}

:deep(.van-cell-group) {
  margin-bottom: 0;
}

:deep(.van-field__label) {
  width: 100px;
}
</style>
