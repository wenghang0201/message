import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import authService from '@/services/auth.service';
import type { AuthResponse, RegisterDto, LoginDto } from '@/types/api';

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref<AuthResponse['user'] | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 获取器
  const isAuthenticated = computed(() => !!accessToken.value);
  const userId = computed(() => user.value?.id);
  const username = computed(() => user.value?.username);
  const email = computed(() => user.value?.email);

  // 操作
  async function register(data: RegisterDto): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await authService.register(data);

      // 保存令牌和用户信息
      accessToken.value = response.accessToken;
      refreshToken.value = response.refreshToken;
      user.value = response.user;

      // 将令牌和用户持久化到 localStorage
      authService.saveTokens(response.accessToken, response.refreshToken);
      authService.saveUser(response.user);
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || '注册失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function login(data: LoginDto): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await authService.login(data);

      // 保存令牌和用户信息
      accessToken.value = response.accessToken;
      refreshToken.value = response.refreshToken;
      user.value = response.user;

      // 将令牌和用户持久化到 localStorage
      authService.saveTokens(response.accessToken, response.refreshToken);
      authService.saveUser(response.user);
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || '登录失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function logout(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      if (refreshToken.value) {
        await authService.logout(refreshToken.value);
      }
    } catch (err: any) {
      // 忽略错误，不阻止登出
    } finally {
      // 清空状态和 localStorage
      user.value = null;
      accessToken.value = null;
      refreshToken.value = null;
      authService.clearTokens();
      isLoading.value = false;
    }
  }

  async function fetchCurrentUser(): Promise<void> {
    if (!authService.isAuthenticated()) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const userData = await authService.getCurrentUser();
      user.value = userData;
      // 将用户数据持久化到 localStorage
      authService.saveUser(userData);
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message || '获取用户信息失败';

      // 如果令牌无效，清空所有内容
      if (err.response?.status === 401) {
        user.value = null;
        accessToken.value = null;
        refreshToken.value = null;
        authService.clearTokens();
      }

      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshTokens(): Promise<void> {
    const currentRefreshToken = refreshToken.value || authService.getRefreshToken();

    if (!currentRefreshToken) {
      throw new Error('没有刷新令牌');
    }

    try {
      const response = await authService.refreshToken(currentRefreshToken);

      // 更新令牌
      accessToken.value = response.accessToken;
      refreshToken.value = response.refreshToken;

      // 持久化新令牌
      authService.saveTokens(response.accessToken, response.refreshToken);
    } catch (err: any) {
      // 刷新失败，清空所有内容
      user.value = null;
      accessToken.value = null;
      refreshToken.value = null;
      authService.clearTokens();

      throw err;
    }
  }

  function initializeFromStorage(): void {
    const storedAccessToken = authService.getAccessToken();
    const storedRefreshToken = authService.getRefreshToken();
    const storedUser = authService.getUser();

    if (storedAccessToken && storedRefreshToken) {
      accessToken.value = storedAccessToken;
      refreshToken.value = storedRefreshToken;

      // 立即从 localStorage 恢复用户数据
      if (storedUser) {
        user.value = storedUser;
      }

      // 在后台获取最新用户数据以便在需要时更新
      fetchCurrentUser().catch(() => {
        // 初始化时忽略错误
      });
    }
  }

  function clearError(): void {
    error.value = null;
  }

  return {
    // 状态
    user,
    accessToken,
    refreshToken,
    isLoading,
    error,

    // 获取器
    isAuthenticated,
    userId,
    username,
    email,

    // 操作
    register,
    login,
    logout,
    fetchCurrentUser,
    refreshTokens,
    initializeFromStorage,
    clearError,
  };
});
