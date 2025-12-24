/**
 * 权限检查工具类
 * 集中所有权限检查逻辑以消除重复
 *
 * 此工具类消除了 ConversationService 中 15+ 处重复的权限检查模式
 *
 * 优势：
 * - 权限逻辑的单一事实来源
 * - 更容易测试权限规则
 * - 整个应用程序中一致的权限检查
 */

import { Repository, IsNull } from 'typeorm';
import { Conversation, ConversationType, MessageSendPermission, MemberAddPermission } from '../models/Conversation.entity';
import { ConversationUser, MemberRole } from '../models/ConversationUser.entity';

export class PermissionChecker {
  constructor(
    private conversationRepository: Repository<Conversation>,
    private conversationUserRepository: Repository<ConversationUser>
  ) {}

  /**
   * 检查用户是否可以在会话中发送消息
   */
  async canSendMessage(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) return false;
    if (conversation.disbandedAt) return false;

    // 单聊：始终允许
    if (conversation.type === ConversationType.SINGLE) return true;

    // 群聊：检查成员资格和权限
    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!membership) return false;

    return this.checkMessageSendPermission(conversation.messageSendPermission, membership.role);
  }

  /**
   * 检查用户是否可以添加成员到会话
   */
  async canAddMember(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) return false;

    // 只有群组会话可以添加成员
    if (conversation.type !== ConversationType.GROUP) return false;

    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!membership) return false;

    return this.checkMemberAddPermission(conversation.memberAddPermission, membership.role);
  }

  /**
   * 检查用户是否是管理员或群主
   */
  async isAdminOrOwner(conversationId: string, userId: string): Promise<boolean> {
    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    return membership?.role === MemberRole.ADMIN || membership?.role === MemberRole.OWNER;
  }

  /**
   * 检查用户是否是群主
   */
  async isOwner(conversationId: string, userId: string): Promise<boolean> {
    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    return membership?.role === MemberRole.OWNER;
  }

  /**
   * 检查用户是否是会话成员
   */
  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    return !!membership;
  }

  /**
   * 根据角色检查消息发送权限
   * @private
   */
  private checkMessageSendPermission(permission: MessageSendPermission, role: MemberRole): boolean {
    switch (permission) {
      case MessageSendPermission.ALL_MEMBERS:
        return true;
      case MessageSendPermission.ADMIN_ONLY:
        return role === MemberRole.ADMIN || role === MemberRole.OWNER;
      case MessageSendPermission.OWNER_ONLY:
        return role === MemberRole.OWNER;
      default:
        return true;
    }
  }

  /**
   * 根据角色检查成员添加权限
   * @private
   */
  private checkMemberAddPermission(permission: MemberAddPermission, role: MemberRole): boolean {
    switch (permission) {
      case MemberAddPermission.ALL_MEMBERS:
        return true;
      case MemberAddPermission.ADMIN_ONLY:
        return role === MemberRole.ADMIN || role === MemberRole.OWNER;
      case MemberAddPermission.OWNER_ONLY:
        return role === MemberRole.OWNER;
      default:
        return role === MemberRole.ADMIN || role === MemberRole.OWNER;
    }
  }
}
