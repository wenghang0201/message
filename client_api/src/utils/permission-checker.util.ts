/**
 * Permission Checker Utility
 * Centralizes all permission checking logic to eliminate duplication
 *
 * This utility eliminates 15+ duplicate permission check patterns
 * found throughout ConversationService (lines 1350-1431).
 *
 * Benefits:
 * - Single source of truth for permission logic
 * - Easier to test permission rules
 * - Consistent permission checking across the application
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
   * Check if user can send messages in conversation
   */
  async canSendMessage(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) return false;
    if (conversation.disbandedAt) return false;

    // Single chats: always allowed
    if (conversation.type === ConversationType.SINGLE) return true;

    // Group chats: check membership and permissions
    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!membership) return false;

    return this.checkMessageSendPermission(conversation.messageSendPermission, membership.role);
  }

  /**
   * Check if user can add members to conversation
   */
  async canAddMember(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) return false;

    // Only group conversations can add members
    if (conversation.type !== ConversationType.GROUP) return false;

    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!membership) return false;

    return this.checkMemberAddPermission(conversation.memberAddPermission, membership.role);
  }

  /**
   * Check if user is admin or owner
   */
  async isAdminOrOwner(conversationId: string, userId: string): Promise<boolean> {
    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    return membership?.role === MemberRole.ADMIN || membership?.role === MemberRole.OWNER;
  }

  /**
   * Check if user is owner
   */
  async isOwner(conversationId: string, userId: string): Promise<boolean> {
    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    return membership?.role === MemberRole.OWNER;
  }

  /**
   * Check if user is a member of the conversation
   */
  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    return !!membership;
  }

  /**
   * Check message send permission based on role
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
   * Check member add permission based on role
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
