import http from '../utils/http';
import {
  RegisterDto,
  LoginDto,
  AuthResponse,
  RefreshTokenResponse,
} from '@/types/api';

/**
 * 认证服务
 * 处理登录、注册、登出、令牌刷新
 */

class AuthService {
  /**
   * 用户注册
   */
  async register(data: RegisterDto): Promise<AuthResponse> {
    const response = await http.post('/auth/register', data);
    return response.data.data;
  }

  /**
   * 用户登录
   */
  async login(data: LoginDto): Promise<AuthResponse> {
    const response = await http.post('/auth/login', data);
    return response.data.data;
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await http.post('/auth/refresh', { refreshToken });
    return response.data.data;
  }

  /**
   * 用户登出
   */
  async logout(refreshToken: string): Promise<void> {
    await http.post('/auth/logout', { refreshToken });
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<AuthResponse['user']> {
    const response = await http.get('/auth/me');
    return response.data.data;
  }

  /**
   * 修改密码
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await http.post('/auth/change-password', { currentPassword, newPassword });
  }

  /**
   * 保存认证令牌到本地存储
   */
  saveTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  /**
   * 保存用户信息到本地存储
   */
  saveUser(user: AuthResponse['user']): void {
    localStorage.setItem('user', JSON.stringify(user));
  }

  /**
   * 获取用户信息从本地存储
   */
  getUser(): AuthResponse['user'] | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * 清除本地存储的令牌和用户信息
   */
  clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  /**
   * 检查是否已登录
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  }

  /**
   * 获取访问令牌
   */
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  /**
   * 获取刷新令牌
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }
}

export default new AuthService();
