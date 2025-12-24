import { Conversation, ConversationType, MessageSendPermission, MemberAddPermission } from "../models/Conversation.entity";
import { ConversationUser, MemberRole } from "../models/ConversationUser.entity";
import { Message } from "../models/Message.entity";
import { MessageStatus, DeliveryStatus } from "../models/MessageStatus.entity";
import { Repository, IsNull } from "typeorm";
import { AppDataSource } from "../config/database";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../utils/app-error.util";
import { ConversationListItem } from "../types/conversation.types";
import { CONVERSATION_LIMITS, SPECIAL_DATES } from "../constants/app.config";
import conversationCoreService from "./conversation-core.service";
import groupService from "./group.service";
import conversationPermissionService from "./conversation-permission.service";

/**
 * 对话服务
 */
export class ConversationService {
  private conversationRepository: Repository<Conversation>;
  private conversationUserRepository: Repository<ConversationUser>;
  private messageRepository: Repository<Message>;
  private messageStatusRepository: Repository<MessageStatus>;

  constructor() {
    this.conversationRepository = AppDataSource.getRepository(Conversation);
    this.conversationUserRepository =
      AppDataSource.getRepository(ConversationUser);
    this.messageRepository = AppDataSource.getRepository(Message);
    this.messageStatusRepository = AppDataSource.getRepository(MessageStatus);
  }

  /**
   * 获取用户的所有对话列表（优化版 - 批量查询减少 N+1 问题）
   * 委托给 ConversationCoreService 处理
   */
  public async getUserConversations(
    userId: string
  ): Promise<ConversationListItem[]> {
    return conversationCoreService.getUserConversations(userId);
  }

  /**
   * 创建群聊
   * 委托给 ConversationCoreService 处理
   */
  public async createGroupConversation(
    userId: string,
    name: string,
    memberIds: string[],
    avatarUrl?: string | null
  ): Promise<Conversation> {
    return conversationCoreService.createGroupConversation(userId, name, memberIds, avatarUrl);
  }

  /**
   * 创建或获取单聊对话
   * 委托给 ConversationCoreService 处理
   */
  public async getOrCreateSingleConversation(
    userId: string,
    otherUserId: string
  ): Promise<{ conversation: Conversation; isNew: boolean }> {
    return conversationCoreService.getOrCreateSingleConversation(userId, otherUserId);
  }

  /**
   * 获取对话详情
   * 委托给 ConversationCoreService 处理
   */
  public async getConversation(
    conversationId: string,
    userId: string
  ): Promise<Conversation> {
    return conversationCoreService.getConversation(conversationId, userId);
  }

  /**
   * 删除对话（仅对当前用户）
   * 委托给 ConversationCoreService 处理
   */
  public async deleteConversation(
    conversationId: string,
    userId: string
  ): Promise<void> {
    return conversationCoreService.deleteConversation(conversationId, userId);
  }

  /**
   * 标记对话消息为已读
   */
  public async markAsRead(
    conversationId: string,
    userId: string,
    messageId?: string
  ): Promise<void> {
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    // 如果没有提供 messageId，标记所有消息为已读
    if (!messageId) {
      // 获取最新的消息（来自其他用户）
      const latestMessage = await this.messageRepository
        .createQueryBuilder("message")
        .where("message.conversationId = :conversationId", { conversationId })
        .andWhere("message.senderId != :userId", { userId })
        .andWhere("message.deletedAt IS NULL")
        .orderBy("message.createdAt", "DESC")
        .addOrderBy("message.id", "DESC")
        .getOne();

      if (latestMessage) {
        member.lastReadMessageId = latestMessage.id;
        await this.conversationUserRepository.save(member);
      }
      return;
    }

    // 原有逻辑：标记特定消息
    const message = await this.messageRepository.findOne({
      where: { id: messageId, conversationId },
    });

    if (!message) {
      throw new NotFoundError("消息未找到");
    }

    // 只更新如果新消息更晚
    let shouldUpdate = true;
    if (member.lastReadMessageId) {
      const currentLastRead = await this.messageRepository.findOne({
        where: { id: member.lastReadMessageId },
      });

      if (currentLastRead && message.createdAt < currentLastRead.createdAt) {
        shouldUpdate = false;
      }
    }

    if (shouldUpdate) {
      member.lastReadMessageId = messageId;
      await this.conversationUserRepository.save(member);
    }

    // 更新消息状态
    let status = await this.messageStatusRepository.findOne({
      where: { messageId, userId },
    });

    if (status) {
      status.status = DeliveryStatus.READ;
      status.timestamp = new Date();
    } else {
      status = this.messageStatusRepository.create({
        messageId,
        userId,
        status: DeliveryStatus.READ,
      });
    }

    await this.messageStatusRepository.save(status);
  }

  /**
   * 获取未读消息数
   */
  private async getUnreadCount(
    conversationId: string,
    userId: string
  ): Promise<number> {
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId },
    });

    if (!member) {
      return 0;
    }

    // 如果对话被隐藏（删除），只计算hiddenUntil之后的消息
    if (member.hiddenUntil) {
      // 获取hiddenUntil之后的所有消息
      const allMessages = await this.messageRepository
        .createQueryBuilder("message")
        .where("message.conversationId = :conversationId", { conversationId })
        .andWhere("message.senderId != :userId", { userId })
        .andWhere("message.deletedAt IS NULL")
        .andWhere("message.createdAt > :hiddenUntil", {
          hiddenUntil: member.hiddenUntil,
        })
        .orderBy("message.createdAt", "ASC")
        .addOrderBy("message.id", "ASC")
        .getMany();

      // 如果没有lastReadMessageId，返回所有hiddenUntil之后的消息数
      if (!member.lastReadMessageId) {
        return allMessages.length;
      }

      // 找到lastReadMessage在列表中的位置
      const lastReadIndex = allMessages.findIndex(msg => msg.id === member.lastReadMessageId);

      if (lastReadIndex === -1) {
        // lastReadMessage不在hiddenUntil之后的列表中，返回所有消息数
        return allMessages.length;
      }

      // 返回lastReadMessage之后的消息数量
      return allMessages.length - lastReadIndex - 1;
    }

    if (!member.lastReadMessageId) {
      // 如果没有已读消息，返回所有消息数（排除自己发的）
      const count = await this.messageRepository
        .createQueryBuilder("message")
        .where("message.conversationId = :conversationId", { conversationId })
        .andWhere("message.senderId != :userId", { userId })
        .andWhere("message.deletedAt IS NULL")
        .getCount();
      return count;
    }

    // 获取最后已读消息
    const lastReadMessage = await this.messageRepository.findOne({
      where: { id: member.lastReadMessageId },
    });

    if (!lastReadMessage) {
      // 如果lastReadMessageId存在但消息已被删除，返回0
      return 0;
    }

    // 获取对话中所有未删除的消息，按时间排序
    const allMessages = await this.messageRepository
      .createQueryBuilder("message")
      .where("message.conversationId = :conversationId", { conversationId })
      .andWhere("message.senderId != :userId", { userId })
      .andWhere("message.deletedAt IS NULL")
      .orderBy("message.createdAt", "ASC")
      .addOrderBy("message.id", "ASC")
      .getMany();

    // 找到lastReadMessage在列表中的位置
    const lastReadIndex = allMessages.findIndex(msg => msg.id === member.lastReadMessageId);

    if (lastReadIndex === -1) {
      // lastReadMessage不在列表中（可能是用户自己发的或已删除），返回所有消息数
      return allMessages.length;
    }

    // 返回lastReadMessage之后的消息数量
    return allMessages.length - lastReadIndex - 1;
  }

  /**
   * 获取群聊成员列表
   * 委托给 GroupService 处理
   */
  public async getGroupMembers(conversationId: string, userId: string) {
    const members = await groupService.getGroupMembers(conversationId, userId);

    return members.map((member) => ({
      userId: member.userId,
      username: member.user.username,
      email: member.user.email,
      avatarUrl: member.user.profile?.avatarUrl || null,
      role: member.role,
      joinedAt: member.joinedAt,
    }));
  }

  /**
   * 添加成员到群聊
   * 委托给 GroupService 处理
   */
  public async addGroupMembers(
    conversationId: string,
    requesterId: string,
    memberIds: string[]
  ) {
    return groupService.addGroupMembers(conversationId, requesterId, memberIds);
  }

  /**
   * 更新成员角色
   * 委托给 GroupService 处理
   */
  public async updateMemberRole(
    conversationId: string,
    requesterId: string,
    targetUserId: string,
    newRole: MemberRole
  ) {
    return groupService.updateMemberRole(conversationId, requesterId, targetUserId, newRole);
  }

  /**
   * 从群聊中移除成员
   * 委托给 GroupService 处理
   */
  public async removeGroupMember(
    conversationId: string,
    requesterId: string,
    targetUserId: string
  ) {
    return groupService.removeGroupMember(conversationId, requesterId, targetUserId);
  }

  /**
   * 置顶/取消置顶对话
   */
  public async togglePin(conversationId: string, userId: string): Promise<void> {
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    // 如果要置顶，检查置顶数量限制
    if (!member.isPinned) {
      const pinnedCount = await this.conversationUserRepository.count({
        where: { userId, isPinned: true, deletedAt: IsNull() },
      });

      if (pinnedCount >= CONVERSATION_LIMITS.MAX_PINNED_CHATS) {
        throw new ValidationError(`最多只能置顶${CONVERSATION_LIMITS.MAX_PINNED_CHATS}个聊天`);
      }
    }

    // 切换置顶状态
    member.isPinned = !member.isPinned;
    member.pinnedAt = member.isPinned ? new Date() : null;
    await this.conversationUserRepository.save(member);
  }

  /**
   * 设置对话静音/免打扰
   */
  public async setMute(
    conversationId: string,
    userId: string,
    duration?: number
  ): Promise<void> {
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    // 如果提供了时长，计算静音截止时间；否则永久静音
    if (duration && duration > 0) {
      const mutedUntil = new Date();
      mutedUntil.setSeconds(mutedUntil.getSeconds() + duration);
      member.mutedUntil = mutedUntil;
    } else {
      // 永久静音：设置为MySQL TIMESTAMP的最大值
      member.mutedUntil = new Date(SPECIAL_DATES.MYSQL_TIMESTAMP_MAX);
    }

    await this.conversationUserRepository.save(member);
  }

  /**
   * 取消对话静音
   */
  public async unmute(conversationId: string, userId: string): Promise<void> {
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    member.mutedUntil = null;
    await this.conversationUserRepository.save(member);
  }

  /**
   * 更新群聊名称
   */
  public async updateGroupName(
    conversationId: string,
    userId: string,
    newName: string
  ): Promise<Conversation> {
    // 验证会话是否存在
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("这不是群组会话");
    }

    // 检查请求者是否为管理员或群主
    const requesterMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!requesterMembership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    if (
      requesterMembership.role !== MemberRole.ADMIN &&
      requesterMembership.role !== MemberRole.OWNER
    ) {
      throw new ForbiddenError("只有管理员和群主可以更改群组名称");
    }

    // 更新群组名称
    conversation.name = newName;
    await this.conversationRepository.save(conversation);

    return conversation;
  }

  /**
   * 更新群聊头像
   */
  public async updateGroupAvatar(
    conversationId: string,
    userId: string,
    newAvatarUrl: string
  ): Promise<Conversation> {
    // 验证会话是否存在
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("这不是群组会话");
    }

    // 检查请求者是否为管理员或群主
    const requesterMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!requesterMembership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    if (
      requesterMembership.role !== MemberRole.ADMIN &&
      requesterMembership.role !== MemberRole.OWNER
    ) {
      throw new ForbiddenError("只有管理员和群主可以更改群组头像");
    }

    // 更新群组头像
    conversation.avatarUrl = newAvatarUrl;
    await this.conversationRepository.save(conversation);

    return conversation;
  }

  /**
   * 更新群组消息发送权限
   * 委托给 ConversationPermissionService 处理
   */
  public async updateMessageSendPermission(
    conversationId: string,
    userId: string,
    permission: MessageSendPermission
  ): Promise<Conversation> {
    return conversationPermissionService.updateMessageSendPermission(conversationId, userId, permission);
  }

  /**
   * 更新群组成员添加权限
   * 委托给 ConversationPermissionService 处理
   */
  public async updateMemberAddPermission(
    conversationId: string,
    userId: string,
    permission: MemberAddPermission
  ): Promise<Conversation> {
    return conversationPermissionService.updateMemberAddPermission(conversationId, userId, permission);
  }

  /**
   * 更新群组入群验证设置
   * 委托给 ConversationPermissionService 处理
   */
  public async updateRequireApproval(
    conversationId: string,
    userId: string,
    requireApproval: boolean
  ): Promise<Conversation> {
    return conversationPermissionService.updateRequireApproval(conversationId, userId, requireApproval);
  }

  /**
   * 退出群组
   * 委托给 GroupService 处理
   */
  public async leaveGroup(
    conversationId: string,
    userId: string
  ): Promise<void> {
    return groupService.leaveGroup(conversationId, userId);
  }

  /**
   * 转让群主
   * 委托给 GroupService 处理
   */
  public async transferOwnership(
    conversationId: string,
    currentOwnerId: string,
    newOwnerId: string
  ): Promise<void> {
    return groupService.transferOwnership(conversationId, currentOwnerId, newOwnerId);
  }

  /**
   * 解散群组
   * 委托给 GroupService 处理
   */
  public async disbandGroup(
    conversationId: string,
    userId: string
  ): Promise<void> {
    return groupService.disbandGroup(conversationId, userId);
  }

  /**
   * 检查用户是否有发送消息的权限
   * 委托给 ConversationPermissionService 处理
   */
  public async canSendMessage(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    return conversationPermissionService.canSendMessage(conversationId, userId);
  }

  /**
   * 检查用户是否有添加成员的权限
   * 委托给 ConversationPermissionService 处理
   */
  public async canAddMember(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    return conversationPermissionService.canAddMember(conversationId, userId);
  }
}

export default new ConversationService();
