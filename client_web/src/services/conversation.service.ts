import http from '../utils/http';
import {
  ConversationListItem,
  CreateGroupConversationDto,
  GroupMember,
  AddGroupMembersDto,
  UpdateMemberRoleDto,
} from '@/types/api';

/**
 * 对话服务
 */

class ConversationService {
  /**
   * 获取用户的所有对话列表
   */
  async getConversations(): Promise<ConversationListItem[]> {
    const response = await http.get('/conversations');
    return response.data.data;
  }

  /**
   * 创建或获取单聊对话
   */
  async getOrCreateSingle(otherUserId: string): Promise<{ id: string }> {
    const response = await http.post('/conversations/single', { otherUserId });
    return response.data.data;
  }

  /**
   * 创建群聊
   */
  async createGroup(data: CreateGroupConversationDto): Promise<{ id: string }> {
    const response = await http.post('/conversations/group', data);
    return response.data.data;
  }

  /**
   * 获取对话详情
   */
  async getConversation(conversationId: string): Promise<any> {
    const response = await http.get(`/conversations/${conversationId}`);
    return response.data.data;
  }

  /**
   * 删除对话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await http.delete(`/conversations/${conversationId}`);
  }

  /**
   * 标记消息为已读
   */
  async markAsRead(conversationId: string, messageId: string): Promise<void> {
    await http.post(`/conversations/${conversationId}/read`, { messageId });
  }

  /**
   * 获取群聊成员列表
   */
  async getGroupMembers(conversationId: string): Promise<GroupMember[]> {
    const response = await http.get(`/conversations/${conversationId}/members`);
    return response.data.data;
  }

  /**
   * 添加成员到群聊
   */
  async addGroupMembers(conversationId: string, data: AddGroupMembersDto): Promise<void> {
    await http.post(`/conversations/${conversationId}/members`, data);
  }

  /**
   * 更新成员角色
   */
  async updateMemberRole(conversationId: string, memberId: string, data: UpdateMemberRoleDto): Promise<void> {
    await http.put(`/conversations/${conversationId}/members/${memberId}/role`, data);
  }

  /**
   * 从群聊中移除成员
   */
  async removeGroupMember(conversationId: string, memberId: string): Promise<void> {
    await http.delete(`/conversations/${conversationId}/members/${memberId}`);
  }

  /**
   * 置顶/取消置顶对话
   */
  async togglePin(conversationId: string): Promise<void> {
    await http.post(`/conversations/${conversationId}/pin`);
  }

  /**
   * 设置对话静音
   * @param conversationId 对话ID
   * @param duration 静音时长（秒），不传表示永久静音
   */
  async setMute(conversationId: string, duration?: number): Promise<void> {
    await http.post(`/conversations/${conversationId}/mute`, { duration });
  }

  /**
   * 取消对话静音
   */
  async unmute(conversationId: string): Promise<void> {
    await http.post(`/conversations/${conversationId}/unmute`);
  }

  /**
   * 更新群聊名称
   */
  async updateGroupName(conversationId: string, name: string): Promise<void> {
    await http.put(`/conversations/${conversationId}/name`, { name });
  }

  /**
   * 更新群聊头像
   */
  async updateGroupAvatar(conversationId: string, avatarUrl: string): Promise<void> {
    await http.put(`/conversations/${conversationId}/avatar`, { avatarUrl });
  }

  /**
   * 更新消息发送权限
   */
  async updateMessageSendPermission(conversationId: string, permission: string): Promise<void> {
    await http.put(`/conversations/${conversationId}/permissions/message-send`, { permission });
  }

  /**
   * 更新成员添加权限
   */
  async updateMemberAddPermission(conversationId: string, permission: string): Promise<void> {
    await http.put(`/conversations/${conversationId}/permissions/member-add`, { permission });
  }

  /**
   * 更新入群验证设置
   */
  async updateRequireApproval(conversationId: string, requireApproval: boolean): Promise<void> {
    await http.put(`/conversations/${conversationId}/permissions/require-approval`, { requireApproval });
  }

  /**
   * 退出群组
   */
  async leaveGroup(conversationId: string): Promise<void> {
    await http.post(`/conversations/${conversationId}/leave`);
  }

  /**
   * 转让群主
   */
  async transferOwnership(conversationId: string, newOwnerId: string): Promise<void> {
    await http.post(`/conversations/${conversationId}/transfer-ownership`, { newOwnerId });
  }

  /**
   * 解散群组
   */
  async disbandGroup(conversationId: string): Promise<void> {
    await http.post(`/conversations/${conversationId}/disband`);
  }
}

export default new ConversationService();
