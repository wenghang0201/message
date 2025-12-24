import { Repository, IsNull } from "typeorm";
import { Conversation, ConversationType } from "../models/Conversation.entity";
import { ConversationUser, MemberRole } from "../models/ConversationUser.entity";
import { Message } from "../models/Message.entity";
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
import { PrivacyUtil } from "../utils/privacy.util";
import { SystemMessageCreator } from "../utils/system-message-creator.util";
import { CONVERSATION_LIMITS, SPECIAL_DATES } from "../constants/app.config";

/**
 * 会话核心服务
 * 处理基本的会话 CRUD 操作
 */
export class ConversationCoreService {
  private conversationRepository: Repository<Conversation>;
  private conversationUserRepository: Repository<ConversationUser>;
  private messageRepository: Repository<Message>;
  private messageStatusRepository: Repository<MessageStatus>;
  private userRepository: Repository<User>;
  private friendRepository: Repository<Friend>;
  private systemMessageCreator: SystemMessageCreator;

  constructor() {
    this.conversationRepository = AppDataSource.getRepository(Conversation);
    this.conversationUserRepository =
      AppDataSource.getRepository(ConversationUser);
    this.messageRepository = AppDataSource.getRepository(Message);
    this.messageStatusRepository = AppDataSource.getRepository(MessageStatus);
    this.userRepository = AppDataSource.getRepository(User);
    this.friendRepository = AppDataSource.getRepository(Friend);
    this.systemMessageCreator = new SystemMessageCreator(
      this.messageRepository,
      this.conversationUserRepository
    );
  }

  /**
   * 获取用户的会话列表（使用预加载优化以防止 N+1 查询）
   */
  public async getUserConversations(
    userId: string
  ): Promise<ConversationListItem[]> {
    // 1. 获取用户参与的所有对话（排除已删除的）- 使用预加载
    const conversationUsers = await this.conversationUserRepository
      .createQueryBuilder("cu")
      .leftJoinAndSelect("cu.conversation", "conversation")
      .where("cu.userId = :userId", { userId })
      .andWhere("cu.deletedAt IS NULL")
      .orderBy("conversation.updatedAt", "DESC")
      .getMany();

    if (conversationUsers.length === 0) {
      return [];
    }

    const conversationIds = conversationUsers.map(cu => cu.conversation.id);

    // 2. 批量获取所有对话的参与者（一次查询代替 N 次）- 使用预加载
    const allParticipants = await this.conversationUserRepository
      .createQueryBuilder("cu")
      .leftJoinAndSelect("cu.user", "user")
      .leftJoinAndSelect("user.profile", "profile")
      .where("cu.conversationId IN (:...conversationIds)", { conversationIds })
      .getMany();

    // 按对话 ID 分组参与者
    const participantsByConversation = new Map<string, ConversationUser[]>();
    allParticipants.forEach(participant => {
      const conversationId = participant.conversationId;
      if (!participantsByConversation.has(conversationId)) {
        participantsByConversation.set(conversationId, []);
      }
      participantsByConversation.get(conversationId)!.push(participant);
    });

    // 3. 批量获取最后一条消息（一次查询代替 N 次）
    // 注意：需要考虑每个用户的 hiddenUntil
    const lastMessages = await this.messageRepository
      .createQueryBuilder("message")
      .where("message.conversationId IN (:...conversationIds)", { conversationIds })
      .andWhere("message.deletedAt IS NULL")
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select("MAX(m2.createdAt)")
          .from(Message, "m2")
          .where("m2.conversationId = message.conversationId")
          .andWhere("m2.deletedAt IS NULL")
          .getQuery();
        return `message.createdAt = ${subQuery}`;
      })
      .getMany();

    // 按对话 ID 映射最后消息
    const lastMessageByConversation = new Map<string, Message>();
    lastMessages.forEach(msg => {
      lastMessageByConversation.set(msg.conversationId, msg);
    });

    // 4. 构建对话列表
    const conversations: ConversationListItem[] = [];

    for (const cu of conversationUsers) {
      const conversation = cu.conversation;

      let name = conversation.name || "";
      let avatar = conversation.avatarUrl || null;
      let otherUserId: string | undefined;
      let isOnline: boolean | undefined;
      let lastSeenAt: Date | null | undefined;

      // 单聊：从已加载的参与者中获取对方用户信息
      if (conversation.type === ConversationType.SINGLE) {
        const participants = participantsByConversation.get(conversation.id) || [];
        const otherParticipant = participants.find(p => p.userId !== userId);

        if (otherParticipant?.user) {
          otherUserId = otherParticipant.userId;
          name = otherParticipant.user.username;
          avatar = otherParticipant.user.profile?.avatarUrl || null;

          // 检查当前用户是否有权查看对方的在线状态
          const canSeeStatus = await PrivacyUtil.canSeeLastSeen(userId, otherParticipant.userId);

          if (canSeeStatus) {
            isOnline = otherParticipant.user.profile?.isOnline || false;
            lastSeenAt = otherParticipant.user.profile?.lastSeenAt || null;
          } else {
            // 没有权限，不返回在线状态
            isOnline = undefined;
            lastSeenAt = undefined;
          }
        }
      }

      // 获取最后一条消息（从已加载的映射中获取）
      let lastMessage = lastMessageByConversation.get(conversation.id) || null;

      // 如果用户有 hiddenUntil，需要过滤掉该时间之前的消息
      if (lastMessage && cu.hiddenUntil && lastMessage.createdAt <= cu.hiddenUntil) {
        // 需要重新查询该时间之后的最后一条消息
        const filteredMessage = await this.messageRepository
          .createQueryBuilder("message")
          .where("message.conversationId = :conversationId", { conversationId: conversation.id })
          .andWhere("message.deletedAt IS NULL")
          .andWhere("message.createdAt > :hiddenUntil", { hiddenUntil: cu.hiddenUntil })
          .orderBy("message.createdAt", "DESC")
          .getOne();
        lastMessage = filteredMessage || null;
      }

      // Calculate unread count (keep original position-based logic)
      const unreadCount = await this.getUnreadCount(conversation.id, userId);

      const item: ConversationListItem = {
        id: conversation.id,
        type: conversation.type,
        name,
        avatar,
        otherUserId,
        unreadCount,
        isPinned: cu.isPinned,
        pinnedAt: cu.pinnedAt,
        mutedUntil: cu.mutedUntil,
        disbandedAt: conversation.disbandedAt,
        isOnline,
        lastSeenAt,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      };

      // Add last message
      if (lastMessage) {
        item.lastMessage = {
          id: lastMessage.id,
          senderId: lastMessage.senderId,
          content: lastMessage.content,
          type: lastMessage.type,
          createdAt: lastMessage.createdAt,
        };
      }

      conversations.push(item);
    }

    return conversations;
  }

  /**
   * Create or get single chat conversation
   */
  public async getOrCreateSingleConversation(
    userId: string,
    otherUserId: string
  ): Promise<{ conversation: Conversation; isNew: boolean }> {
    if (userId === otherUserId) {
      throw new ValidationError("无法与自己创建会话");
    }

    // Check if other user exists
    const otherUser = await this.userRepository.findOne({
      where: { id: otherUserId },
    });
    if (!otherUser) {
      throw new NotFoundError("用户未找到");
    }

    // Verify friendship exists
    const friendship = await this.friendRepository.findOne({
      where: [
        { requesterId: userId, recipientId: otherUserId, status: FriendStatus.ACCEPTED },
        { requesterId: otherUserId, recipientId: userId, status: FriendStatus.ACCEPTED },
      ],
    });

    if (!friendship) {
      throw new ForbiddenError("只能与好友创建对话");
    }

    // Find existing single chat conversation (including soft-deleted)
    const userConversations = await this.conversationUserRepository.find({
      where: { userId },
      relations: ["conversation"],
    });

    for (const uc of userConversations) {
      if (uc.conversation.type === ConversationType.SINGLE) {
        // Check if other user is in this conversation
        const members = await this.conversationUserRepository.find({
          where: { conversationId: uc.conversationId },
        });

        const otherMember = members.find(m => m.userId === otherUserId);
        if (otherMember) {
          // If conversation exists but soft-deleted, restore access for current user only
          // Other user's conversation stays hidden until first message is sent
          if (uc.deletedAt !== null) {
            uc.deletedAt = null;
            await this.conversationUserRepository.save(uc);
            // For user initiating restore, treat as new conversation
            return { conversation: uc.conversation, isNew: true };
          }

          return { conversation: uc.conversation, isNew: false };
        }
      }
    }

    // Create new single chat conversation
    const conversation = this.conversationRepository.create({
      type: ConversationType.SINGLE,
      createdById: userId,
    });

    await this.conversationRepository.save(conversation);

    // Add both users to conversation
    // Creator immediately sees conversation
    const user1 = this.conversationUserRepository.create({
      conversationId: conversation.id,
      userId: userId,
      role: MemberRole.MEMBER,
    });

    // Other user's conversation is temporarily hidden until first message
    const now = new Date();
    const user2 = this.conversationUserRepository.create({
      conversationId: conversation.id,
      userId: otherUserId,
      role: MemberRole.MEMBER,
      deletedAt: now,
      hiddenUntil: now,
    });

    await this.conversationUserRepository.save([user1, user2]);

    return { conversation, isNew: true };
  }

  /**
   * Create group conversation
   */
  public async createGroupConversation(
    userId: string,
    name: string,
    memberIds: string[],
    avatarUrl?: string | null
  ): Promise<Conversation> {
    // Validate all member users exist
    const allUserIds = [userId, ...memberIds];
    const users = await this.userRepository.find({
      where: allUserIds.map(id => ({ id })),
    });

    if (users.length !== allUserIds.length) {
      throw new NotFoundError("一个或多个用户未找到");
    }

    // Create group conversation
    const conversation = this.conversationRepository.create({
      type: ConversationType.GROUP,
      name,
      avatarUrl: avatarUrl || null,
      createdById: userId,
    });

    await this.conversationRepository.save(conversation);

    // Add creator as group owner
    const owner = this.conversationUserRepository.create({
      conversationId: conversation.id,
      userId: userId,
      role: MemberRole.OWNER,
    });

    // Add other members
    const members = memberIds.map(memberId =>
      this.conversationUserRepository.create({
        conversationId: conversation.id,
        userId: memberId,
        role: MemberRole.MEMBER,
      })
    );

    await this.conversationUserRepository.save([owner, ...members]);

    // Get creator and member usernames
    const creatorUser = users.find(u => u.id === userId);
    const memberUsers = users.filter(u => memberIds.includes(u.id));

    // Create system message: group created
    let systemMessageContent = `${creatorUser?.username || "用户"} 创建了群聊`;
    if (memberUsers.length > 0) {
      const memberNames = memberUsers.map(u => u.username).join("、");
      systemMessageContent += ` 并邀请 ${memberNames} 加入群聊`;
    }

    await this.systemMessageCreator.createSystemMessage(conversation.id, systemMessageContent, userId);

    return conversation;
  }

  /**
   * Get conversation details
   */
  public async getConversation(
    conversationId: string,
    userId: string
  ): Promise<Conversation> {
    // Verify user is conversation member
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    return conversation;
  }

  /**
   * Delete conversation (for current user only)
   */
  public async deleteConversation(
    conversationId: string,
    userId: string
  ): Promise<void> {
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    // Get last message to mark as read
    const lastMessage = await this.messageRepository.findOne({
      where: {
        conversationId,
        deletedAt: IsNull(),
      },
      order: { createdAt: "DESC" },
    });

    const now = new Date();
    // Soft delete: set deletedAt to hide conversation, set hiddenUntil to record deletion time
    // hiddenUntil filters old messages, only showing messages after deletion
    // Also mark all messages as read to avoid showing old unread count when conversation is recreated
    member.deletedAt = now;
    member.hiddenUntil = now;
    member.lastReadMessageId = lastMessage?.id || null;
    await this.conversationUserRepository.save(member);
  }

  /**
   * Mark conversation messages as read
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

    // If no messageId provided, mark all messages as read
    if (!messageId) {
      // Get latest message (from other users)
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

    // Original logic: mark specific message
    const message = await this.messageRepository.findOne({
      where: { id: messageId, conversationId },
    });

    if (!message) {
      throw new NotFoundError("消息未找到");
    }

    // Only update if new message is later
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

    // Update message status
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
   * Toggle pin/unpin conversation
   */
  public async togglePin(conversationId: string, userId: string): Promise<void> {
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    // If pinning, check pin count limit (max from config)
    if (!member.isPinned) {
      const pinnedCount = await this.conversationUserRepository.count({
        where: { userId, isPinned: true, deletedAt: IsNull() },
      });

      if (pinnedCount >= CONVERSATION_LIMITS.MAX_PINNED_CHATS) {
        throw new ValidationError(`最多只能置顶${CONVERSATION_LIMITS.MAX_PINNED_CHATS}个聊天`);
      }
    }

    // Toggle pin status
    member.isPinned = !member.isPinned;
    member.pinnedAt = member.isPinned ? new Date() : null;
    await this.conversationUserRepository.save(member);
  }

  /**
   * Set conversation mute/do not disturb
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

    // If duration provided, calculate mute end time; otherwise permanent mute
    if (duration && duration > 0) {
      const mutedUntil = new Date();
      mutedUntil.setSeconds(mutedUntil.getSeconds() + duration);
      member.mutedUntil = mutedUntil;
    } else {
      // Permanent mute: set to MySQL TIMESTAMP max value (2038-01-19)
      member.mutedUntil = new Date(SPECIAL_DATES.MYSQL_TIMESTAMP_MAX);
    }

    await this.conversationUserRepository.save(member);
  }

  /**
   * Unmute conversation
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
   * Update group name
   */
  public async updateGroupName(
    conversationId: string,
    userId: string,
    newName: string
  ): Promise<Conversation> {
    // Verify conversation exists
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("这不是群组会话");
    }

    // Check if requester is admin or owner
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

    // Update group name
    conversation.name = newName;
    await this.conversationRepository.save(conversation);

    return conversation;
  }

  /**
   * Update group avatar
   */
  public async updateGroupAvatar(
    conversationId: string,
    userId: string,
    newAvatarUrl: string
  ): Promise<Conversation> {
    // Verify conversation exists
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ValidationError("这不是群组会话");
    }

    // Check if requester is admin or owner
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

    // Update group avatar
    conversation.avatarUrl = newAvatarUrl;
    await this.conversationRepository.save(conversation);

    return conversation;
  }

  /**
   * Get unread message count (private helper)
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

    // If conversation is hidden (deleted), only count messages after hiddenUntil
    if (member.hiddenUntil) {
      // Get all messages after hiddenUntil
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

      // If no lastReadMessageId, return count of all messages after hiddenUntil
      if (!member.lastReadMessageId) {
        return allMessages.length;
      }

      // Find lastReadMessage position in list
      const lastReadIndex = allMessages.findIndex(msg => msg.id === member.lastReadMessageId);

      if (lastReadIndex === -1) {
        // lastReadMessage not in list after hiddenUntil, return all message count
        return allMessages.length;
      }

      // Return count of messages after lastReadMessage
      return allMessages.length - lastReadIndex - 1;
    }

    if (!member.lastReadMessageId) {
      // If no read messages, return all message count (excluding own messages)
      const count = await this.messageRepository
        .createQueryBuilder("message")
        .where("message.conversationId = :conversationId", { conversationId })
        .andWhere("message.senderId != :userId", { userId })
        .andWhere("message.deletedAt IS NULL")
        .getCount();
      return count;
    }

    // Get last read message
    const lastReadMessage = await this.messageRepository.findOne({
      where: { id: member.lastReadMessageId },
    });

    if (!lastReadMessage) {
      // If lastReadMessageId exists but message is deleted, return 0
      return 0;
    }

    // Get all undeleted messages in conversation, sorted by time
    const allMessages = await this.messageRepository
      .createQueryBuilder("message")
      .where("message.conversationId = :conversationId", { conversationId })
      .andWhere("message.senderId != :userId", { userId })
      .andWhere("message.deletedAt IS NULL")
      .orderBy("message.createdAt", "ASC")
      .addOrderBy("message.id", "ASC")
      .getMany();

    // Find lastReadMessage position in list
    const lastReadIndex = allMessages.findIndex(msg => msg.id === member.lastReadMessageId);

    if (lastReadIndex === -1) {
      // lastReadMessage not in list (might be own message or deleted), return all message count
      return allMessages.length;
    }

    // Return count of messages after lastReadMessage
    return allMessages.length - lastReadIndex - 1;
  }
}

export default new ConversationCoreService();
