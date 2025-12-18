import http from '../utils/http';
import {
  UserProfile,
  UpdateProfileDto,
  UpdatePrivacyDto,
} from '@/types/api';

/**
 * 用户资料服务
 */

class ProfileService {
  /**
   * 获取当前用户资料
   */
  async getMyProfile(): Promise<UserProfile> {
    const response = await http.get('/profile/me');
    return response.data.data;
  }

  /**
   * 获取指定用户资料
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const response = await http.get(`/profile/${userId}`);
    return response.data.data;
  }

  /**
   * 更新当前用户资料
   */
  async updateMyProfile(data: UpdateProfileDto): Promise<UserProfile> {
    const response = await http.put('/profile/me', data);
    return response.data.data;
  }

  /**
   * 更新在线状态
   */
  async updateOnlineStatus(isOnline: boolean): Promise<UserProfile> {
    const response = await http.patch('/profile/status', { isOnline });
    return response.data.data;
  }

  /**
   * 更新隐私设置
   */
  async updatePrivacySettings(settings: UpdatePrivacyDto): Promise<UserProfile> {
    const response = await http.patch('/profile/privacy', settings);
    return response.data.data;
  }
}

export default new ProfileService();
