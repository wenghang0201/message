<template>
  <div class="register-container">
    <div class="register-header">
      <h1>创建账户</h1>
      <p>加入我们开始聊天</p>
    </div>

    <van-cell-group inset>
      <van-field
        v-model="formData.username"
        name="username"
        label="用户名"
        placeholder="请输入用户名"
        clearable
      />
      <van-field
        v-model="formData.email"
        name="email"
        label="邮箱"
        placeholder="请输入邮箱"
        clearable
      />
      <van-field
        v-model="formData.password"
        type="password"
        name="password"
        label="密码"
        placeholder="请输入密码（至少6位）"
        clearable
      />
      <van-field
        v-model="confirmPassword"
        type="password"
        name="confirmPassword"
        label="确认密码"
        placeholder="请再次输入密码"
        clearable
        @keyup.enter="handleRegister"
      />
    </van-cell-group>

    <div class="register-actions">
      <van-button
        round
        block
        type="primary"
        :loading="authStore.isLoading"
        :disabled="authStore.isLoading"
        @click="handleRegister"
      >
        注册
      </van-button>

      <div class="login-link">
        <span>已有账户？</span>
        <van-button type="primary" text="true" @click="goToLogin">
          立即登录
        </van-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showNotify } from 'vant';
import { useAuthStore } from '@/stores/auth';
import { RegisterDto } from '@/types/api';

const router = useRouter();
const authStore = useAuthStore();

const formData = reactive<RegisterDto>({
  username: '',
  email: '',
  password: '',
});

const confirmPassword = ref('');

const handleRegister = async () => {
  // 验证用户名
  if (!formData.username.trim()) {
    showNotify({
      type: 'warning',
      message: '请输入用户名',
    });
    return;
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(formData.username)) {
    showNotify({
      type: 'warning',
      message: '用户名必须是3-20个字符，只能包含字母、数字和下划线',
    });
    return;
  }

  // 验证邮箱
  if (!formData.email.trim()) {
    showNotify({
      type: 'warning',
      message: '请输入邮箱',
    });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    showNotify({
      type: 'warning',
      message: '请输入有效的邮箱地址',
    });
    return;
  }

  // 验证密码
  if (!formData.password) {
    showNotify({
      type: 'warning',
      message: '请输入密码',
    });
    return;
  }

  if (formData.password.length < 6) {
    showNotify({
      type: 'warning',
      message: '密码至少需要6个字符',
    });
    return;
  }

  // 验证确认密码
  if (!confirmPassword.value) {
    showNotify({
      type: 'warning',
      message: '请再次输入密码',
    });
    return;
  }

  if (confirmPassword.value !== formData.password) {
    showNotify({
      type: 'warning',
      message: '两次输入的密码不一致',
    });
    return;
  }

  try {
    await authStore.register(formData);

    showNotify({
      type: 'success',
      message: '注册成功',
    });

    await router.replace('/chats');
  } catch (err: any) {
    console.error('注册错误:', err);
    showNotify({
      type: 'danger',
      message: err.response?.data?.message || '注册失败，请检查输入信息',
    });
  }
};

function goToLogin() {
  router.push('/login');
}
</script>

<style scoped>
.register-container {
  min-height: 100vh;
  padding: 60px 16px 16px;
  background: var(--van-background-2);
}

.register-header {
  text-align: center;
  margin-bottom: 40px;
  color: var(--van-text-color);
}

.register-header h1 {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--van-primary-color);
}

.register-header p {
  font-size: 16px;
  color: var(--van-text-color-2);
}

.register-actions {
  margin-top: 24px;
  padding: 0 16px;
}

.register-actions .van-button {
  margin-bottom: 16px;
}

.login-link {
  text-align: center;
  color: var(--van-text-color-2);
  font-size: 14px;
}

.login-link span {
  margin-right: 8px;
}

:deep(.van-cell-group) {
  margin-bottom: 0;
}

:deep(.van-field__label) {
  width: 100px;
}
</style>
