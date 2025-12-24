import { Repository, IsNull } from "typeorm";
import { Conversation, ConversationType, MessageSendPermission, MemberAddPermission } from "../models/Conversation.entity";
import { ConversationUser, MemberRole } from "../models/ConversationUser.entity";
import { Message, MessageType } from "../models/Message.entity";
import { MessageStatus, DeliveryStatus } from "../models/MessageStatus.entity";
import { User } from "../models/User.entity";
import { Friend, FriendStatus } from "../models/Friend.entity";
import { AppDataSource } from "../config/database";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../utils/app-error.util";
import { ConversationListItem } from "../types/conversation.types";
import websocketService from "./websocket.service";
import { WebSocketEvent } from "../constants/websocket-events";
import { PrivacyUtil } from "../utils/privacy.util";
import { CONVERSATION_LIMITS, SPECIAL_DATES } from "../constants/app.config";
import { PermissionChecker } from "../utils/permission-checker.util";
import { SystemMessageCreator } from "../utils/system-message-creator.util";
import conversationCoreService from "./conversation-core.service";

/**
 * 对话服务
 */
export class ConversationService {
  private conversationRepository: Repository<Conversation>;
  private conversationUserRepository: Repository<ConversationUser>;
  private messageRepository: Repository<Message>;
  private messageStatusRepository: Repository<MessageStatus>;
  private userRepository: Repository<User>;
  private friendRepository: Repository<Friend>;
  private permissionChecker: PermissionChecker;
  private systemMessageCreator: SystemMessageCreator;

  constructor() {
    this.conversationRepository = AppDataSource.getRepository(Conversation);
    this.conversationUserRepository =
      AppDataSource.getRepository(ConversationUser);
    this.messageRepository = AppDataSource.getRepository(Message);
    this.messageStatusRepository = AppDataSource.getRepository(MessageStatus);
    this.userRepository = AppDataSource.getRepository(User);
    this.friendRepository = AppDataSource.getRepository(Friend);
    this.permissionChecker = new PermissionChecker(
      this.conversationRepository,
      this.conversationUserRepository
    );
    this.systemMessageCreator = new SystemMessageCreator(
      this.messageRepository,
      this.conversationUserRepository
    );
  }

  /**
   * 创建系统消息
   * 使用 SystemMessageCreator 工具类以消除重复代码
   */
  private async createSystemMessage(
    conversationId: string,
    content: string,
    senderId: string = "system",
    excludeUserId?: string
  ): Promise<Message> {
    return this.systemMessageCreator.createSystemMessage(
      conversationId,
      content,
      senderId,
      excludeUserId
    );
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
   * 获取群聊成员列表 - 优化版，使用eager loading减少查询
   */
  public async getGroupMembers(conversationId: string, userId: string) {
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

    // 检查用户是否为成员
    const userMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!userMembership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    // 获取所有成员 - 使用QueryBuilder进行eager loading和排序
    const members = await this.conversationUserRepository
      .createQueryBuilder("cu")
      .leftJoinAndSelect("cu.user", "user")
      .leftJoinAndSelect("user.profile", "profile")
      .where("cu.conversationId = :conversationId", { conversationId })
      .andWhere("cu.deletedAt IS NULL")
      .orderBy("cu.role", "DESC")
      .addOrderBy("cu.joinedAt", "ASC")
      .getMany();

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
   */
  public async addGroupMembers(
    conversationId: string,
    requesterId: string,
    memberIds: string[]
  ) {
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

    // 检查请求者是否有权限添加成员
    const canAdd = await this.canAddMember(conversationId, requesterId);
    if (!canAdd) {
      throw new ForbiddenError("您没有向此群组添加成员的权限");
    }

    // 获取邀请者信息
    const requester = await this.userRepository.findOne({ where: { id: requesterId } });

    // 添加每个成员
    const addedMembers: string[] = [];
    for (const memberId of memberIds) {
      // 检查用户是否存在
      const user = await this.userRepository.findOne({
        where: { id: memberId },
      });

      if (!user) {
        throw new NotFoundError(`User ${memberId} not found`);
      }

      // 检查是否已是成员
      const existingMember = await this.conversationUserRepository.findOne({
        where: { conversationId, userId: memberId },
      });

      if (existingMember) {
        // 如果之前已删除，则恢复成员资格
        if (existingMember.deletedAt) {
          existingMember.deletedAt = null;
          existingMember.hiddenUntil = null;
          await this.conversationUserRepository.save(existingMember);
        }
        continue;
      }

      // 创建新成员
      const newMember = this.conversationUserRepository.create({
        conversationId,
        userId: memberId,
        role: MemberRole.MEMBER,
      });

      await this.conversationUserRepository.save(newMember);
      addedMembers.push(user.username);
    }

    // 创建系统消息：邀请成员加入
    if (addedMembers.length > 0) {
      const memberNames = addedMembers.join("、");
      const systemMessageContent = `${requester?.username || "用户"} 邀请 ${memberNames} 加入群聊`;
      await this.createSystemMessage(conversationId, systemMessageContent, requesterId);
    }
  }

  /**
   * 更新成员角色
   */
  public async updateMemberRole(
    conversationId: string,
    requesterId: string,
    targetUserId: string,
    newRole: MemberRole
  ) {
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

    // 检查请求者是否为群主
    const requesterMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: requesterId, deletedAt: IsNull() },
    });

    if (!requesterMembership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    if (requesterMembership.role !== MemberRole.OWNER) {
      throw new ForbiddenError("只有群主可以更改成员角色");
    }

    // 不能更改自己的角色
    if (requesterId === targetUserId) {
      throw new ValidationError("无法更改自己的角色");
    }

    // 获取目标成员
    const targetMember = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: targetUserId, deletedAt: IsNull() },
    });

    if (!targetMember) {
      throw new NotFoundError("成员未找到");
    }

    // 不能更改群主角色
    if (targetMember.role === MemberRole.OWNER) {
      throw new ValidationError("无法更改群主的角色");
    }

    // 只允许设置为管理员或普通成员
    if (newRole !== MemberRole.ADMIN && newRole !== MemberRole.MEMBER) {
      throw new ValidationError("只能设置角色为管理员或普通成员");
    }

    targetMember.role = newRole;
    await this.conversationUserRepository.save(targetMember);

    // 获取操作者和目标用户的用户名
    const [requesterUser, targetUser] = await Promise.all([
      this.userRepository.findOne({ where: { id: requesterId } }),
      this.userRepository.findOne({ where: { id: targetUserId } }),
    ]);

    // 创建系统消息：角色变更
    const roleText = newRole === MemberRole.ADMIN ? "管理员" : "普通成员";
    const systemMessageContent = `${requesterUser?.username || "用户"} 将 ${targetUser?.username || "用户"} 设置为${roleText}`;
    await this.createSystemMessage(conversationId, systemMessageContent, requesterId);
  }

  /**
   * 从群聊中移除成员
   */
  public async removeGroupMember(
    conversationId: string,
    requesterId: string,
    targetUserId: string
  ) {
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
      where: { conversationId, userId: requesterId, deletedAt: IsNull() },
    });

    if (!requesterMembership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    if (
      requesterMembership.role !== MemberRole.ADMIN &&
      requesterMembership.role !== MemberRole.OWNER
    ) {
      throw new ForbiddenError("只有管理员和群主可以移除成员");
    }

    // 获取目标成员
    const targetMember = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: targetUserId, deletedAt: IsNull() },
    });

    if (!targetMember) {
      throw new NotFoundError("成员未找到");
    }

    // 不能移除群主
    if (targetMember.role === MemberRole.OWNER) {
      throw new ValidationError("无法移除群主");
    }

    // 管理员只能移除普通成员
    if (
      requesterMembership.role === MemberRole.ADMIN &&
      targetMember.role === MemberRole.ADMIN
    ) {
      throw new ForbiddenError("管理员无法移除其他管理员");
    }

    // 获取移除者和被移除者信息
    const requester = await this.userRepository.findOne({ where: { id: requesterId } });
    const targetUser = await this.userRepository.findOne({ where: { id: targetUserId } });

    // 软删除成员资格
    targetMember.deletedAt = new Date();
    // 将hiddenUntil设置为遥远的未来日期，这样他们就看不到以前的消息
    targetMember.hiddenUntil = new Date(SPECIAL_DATES.FAR_FUTURE_DATE);
    await this.conversationUserRepository.save(targetMember);

    // 创建系统消息：移除成员（排除被移除的用户）
    const systemMessageContent = `${requester?.username || "用户"} 将 ${targetUser?.username || "用户"} 移出了群聊`;
    await this.createSystemMessage(conversationId, systemMessageContent, requesterId, targetUserId);
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
   */
  public async updateMessageSendPermission(
    conversationId: string,
    userId: string,
    permission: MessageSendPermission
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("这不是群组会话");
    }

    // 只有群主可以更改权限
    const requesterMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!requesterMembership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    if (requesterMembership.role !== MemberRole.OWNER) {
      throw new ForbiddenError("只有群主可以更改消息发送权限");
    }

    conversation.messageSendPermission = permission;
    await this.conversationRepository.save(conversation);

    return conversation;
  }

  /**
   * 更新群组成员添加权限
   */
  public async updateMemberAddPermission(
    conversationId: string,
    userId: string,
    permission: MemberAddPermission
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("这不是群组会话");
    }

    // 只有群主可以更改权限
    const requesterMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!requesterMembership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    if (requesterMembership.role !== MemberRole.OWNER) {
      throw new ForbiddenError("只有群主可以更改成员添加权限");
    }

    conversation.memberAddPermission = permission;
    await this.conversationRepository.save(conversation);

    return conversation;
  }

  /**
   * 更新群组入群验证设置
   */
  public async updateRequireApproval(
    conversationId: string,
    userId: string,
    requireApproval: boolean
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("这不是群组会话");
    }

    // 只有群主可以更改权限
    const requesterMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!requesterMembership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    if (requesterMembership.role !== MemberRole.OWNER) {
      throw new ForbiddenError("只有群主可以更改入群验证设置");
    }

    conversation.requireApproval = requireApproval;
    await this.conversationRepository.save(conversation);

    return conversation;
  }

  /**
   * 退出群组
   */
  public async leaveGroup(
    conversationId: string,
    userId: string
  ): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("这不是群组会话");
    }

    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!membership) {
      throw new ForbiddenError("您不是此群组的成员");
    }

    // 群主不能退出群组，必须先转让群主或解散群组
    if (membership.role === MemberRole.OWNER) {
      throw new ForbiddenError("群主无法退出。请先转让群主或解散群组。");
    }

    // 获取用户信息
    const user = await this.userRepository.findOne({ where: { id: userId } });

    // 软删除成员资格
    membership.deletedAt = new Date();
    await this.conversationUserRepository.save(membership);

    // 创建系统消息：退出群聊（排除刚退出的用户）
    const systemMessageContent = `${user?.username || "用户"} 退出了群聊`;
    await this.createSystemMessage(conversationId, systemMessageContent, userId, userId);

    // 通知退出的用户，让前端立即更新
    websocketService.sendMessageToUser(userId, WebSocketEvent.MEMBER_LEFT_GROUP, {
      conversationId,
      userId,
    });
  }

  /**
   * 转让群主
   */
  public async transferOwnership(
    conversationId: string,
    currentOwnerId: string,
    newOwnerId: string
  ): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("这不是群组会话");
    }

    // 验证当前用户是群主
    const currentOwnerMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: currentOwnerId, deletedAt: IsNull() },
    });

    if (!currentOwnerMembership || currentOwnerMembership.role !== MemberRole.OWNER) {
      throw new ForbiddenError("只有群主可以转让群主");
    }

    // 验证新群主是成员
    const newOwnerMembership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId: newOwnerId, deletedAt: IsNull() },
    });

    if (!newOwnerMembership) {
      throw new NotFoundError("新群主不是此群组的成员");
    }

    // 转让群主
    currentOwnerMembership.role = MemberRole.ADMIN;
    newOwnerMembership.role = MemberRole.OWNER;

    await this.conversationUserRepository.save([currentOwnerMembership, newOwnerMembership]);
  }

  /**
   * 解散群组
   */
  public async disbandGroup(
    conversationId: string,
    userId: string
  ): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("这不是群组会话");
    }

    // 只有群主可以解散群组
    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!membership || membership.role !== MemberRole.OWNER) {
      throw new ForbiddenError("只有群主可以解散群组");
    }

    // 获取用户信息以创建系统消息
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    const userName = user?.username || "群主";

    // 将会话标记为已解散而不是删除成员
    // 这样可以让群组对所有成员可见并保留消息历史
    // 但阻止任何人发送新消息
    conversation.disbandedAt = new Date();
    await this.conversationRepository.save(conversation);

    // 创建系统消息通知所有成员
    const systemMessage = this.messageRepository.create({
      conversationId,
      senderId: userId,
      type: MessageType.SYSTEM,
      content: `${userName} 解散了该群组`,
    });
    await this.messageRepository.save(systemMessage);

    // 获取所有活跃成员以发送WebSocket通知
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
    });

    // 向所有成员发送WebSocket事件
    members.forEach((member) => {
      // 发送系统消息
      websocketService.sendMessageToUser(member.userId, WebSocketEvent.NEW_MESSAGE, {
        id: systemMessage.id,
        conversationId: systemMessage.conversationId,
        senderId: systemMessage.senderId,
        type: systemMessage.type,
        content: systemMessage.content,
        createdAt: systemMessage.createdAt.toISOString(),
        editedAt: null,
        replyToMessageId: null,
      });

      // 发送群组解散事件以更新聊天存储
      websocketService.sendMessageToUser(member.userId, WebSocketEvent.GROUP_DISBANDED, {
        conversationId,
        disbandedAt: conversation.disbandedAt,
        disbandedBy: userId,
      });
    });
  }

  /**
   * 检查用户是否有发送消息的权限
   * 使用 PermissionChecker 工具类以消除重复代码
   */
  public async canSendMessage(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    return this.permissionChecker.canSendMessage(conversationId, userId);
  }

  /**
   * 检查用户是否有添加成员的权限
   * 使用 PermissionChecker 工具类以消除重复代码
   */
  public async canAddMember(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    return this.permissionChecker.canAddMember(conversationId, userId);
  }
}

export default new ConversationService();
