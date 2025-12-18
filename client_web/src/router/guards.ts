import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

/**
 * 认证守卫
 * 如果用户未认证则重定向到登录页
 */
export function requireAuth(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
): void {
  const authStore = useAuthStore();

  if (!authStore.isAuthenticated) {
    // 保存预期的目标页面
    next({
      path: '/login',
      query: { redirect: to.fullPath },
    });
  } else {
    next();
  }
}

/**
 * 访客守卫
 * 如果用户已认证则重定向到聊天列表
 */
export function requireGuest(
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
): void {
  const authStore = useAuthStore();

  if (authStore.isAuthenticated) {
    next('/chats');
  } else {
    next();
  }
}

/**
 * 从 localStorage 初始化认证状态
 * 应该在应用启动时调用一次
 */
export function initializeAuth(): void {
  const authStore = useAuthStore();
  authStore.initializeFromStorage();
}
