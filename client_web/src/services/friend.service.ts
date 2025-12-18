import http from '../utils/http';
import {
  FriendListItem,
  FriendRequestItem,
  SearchUserItem,
} from '@/types/api';

class FriendService {
  /**
   * 发送好友请求
   */
  async sendFriendRequest(recipientId: string): Promise<any> {
    const response = await http.post('/friends/request', { recipientId });
    return response.data.data;
  }

  /**
   * 接受好友请求
   */
  async acceptFriendRequest(friendshipId: string): Promise<any> {
    const response = await http.post(`/friends/requests/${friendshipId}/accept`);
    return response.data.data;
  }

  /**
   * 拒绝好友请求
   */
  async rejectFriendRequest(friendshipId: string): Promise<void> {
    await http.post(`/friends/requests/${friendshipId}/reject`);
  }

  /**
   * 获取好友列表
   */
  async getFriends(): Promise<FriendListItem[]> {
    const response = await http.get('/friends');
    return response.data.data;
  }

  /**
   * 获取待处理的好友请求
   */
  async getPendingRequests(): Promise<FriendRequestItem[]> {
    const response = await http.get('/friends/requests/pending');
    return response.data.data;
  }

  /**
   * 获取发送的好友请求
   */
  async getSentRequests(): Promise<FriendRequestItem[]> {
    const response = await http.get('/friends/requests/sent');
    return response.data.data;
  }

  /**
   * 删除好友
   */
  async removeFriend(friendshipId: string): Promise<void> {
    await http.delete(`/friends/${friendshipId}`);
  }

  /**
   * 搜索用户
   */
  async searchUsers(query: string): Promise<SearchUserItem[]> {
    const response = await http.get('/users/search', {
      params: { query },
    });
    return response.data.data;
  }
}

export default new FriendService();
