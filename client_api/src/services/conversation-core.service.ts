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

      // 计算未读数（保持原有的位置计算逻辑）
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

      // 添加最后一条消息
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

    // 检查对方用户是否存在
    const otherUser = await this.userRepository.findOne({
      where: { id: otherUserId },
    });
    if (!otherUser) {
      throw new NotFoundError("用户未找到");
    }

    // 验证好友关系是否存在
    const friendship = await this.friendRepository.findOne({
      where: [
        { requesterId: userId, recipientId: otherUserId, status: FriendStatus.ACCEPTED },
        { requesterId: otherUserId, recipientId: userId, status: FriendStatus.ACCEPTED },
      ],
    });

    if (!friendship) {
      throw new ForbiddenError("只能与好友创建对话");
    }

    // 查找已存在的单聊会话（包括软删除的）
    const userConversations = await this.conversationUserRepository.find({
      where: { userId },
      relations: ["conversation"],
    });

    for (const uc of userConversations) {
      if (uc.conversation.type === ConversationType.SINGLE) {
        // 检查对方用户是否在此会话中
        const members = await this.conversationUserRepository.find({
          where: { conversationId: uc.conversationId },
        });

        const otherMember = members.find(m => m.userId === otherUserId);
        if (otherMember) {
          // 如果会话存在但已软删除，仅为当前用户恢复访问权限
          // 对方用户的会话保持隐藏状态，直到发送第一条消息
          if (uc.deletedAt !== null) {
            uc.deletedAt = null;
            await this.conversationUserRepository.save(uc);
            // 对于发起恢复的用户，视为新会话
            return { conversation: uc.conversation, isNew: true };
          }

          return { conversation: uc.conversation, isNew: false };
        }
      }
    }

    // 创建新的单聊会话
    const conversation = this.conversationRepository.create({
      type: ConversationType.SINGLE,
      createdById: userId,
    });

    await this.conversationRepository.save(conversation);

    // 将两个用户添加到会话
    // 创建者立即可见会话
    const user1 = this.conversationUserRepository.create({
      conversationId: conversation.id,
      userId: userId,
      role: MemberRole.MEMBER,
    });

    // 对方用户的会话暂时隐藏，直到发送第一条消息
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
   * 创建群组会话
   */
  public async createGroupConversation(
    userId: string,
    name: string,
    memberIds: string[],
    avatarUrl?: string | null
  ): Promise<Conversation> {
    // 验证所有成员用户是否存在
    const allUserIds = [userId, ...memberIds];
    const users = await this.userRepository.find({
      where: allUserIds.map(id => ({ id })),
    });

    if (users.length !== allUserIds.length) {
      throw new NotFoundError("一个或多个用户未找到");
    }

    // 创建群组会话
    const conversation = this.conversationRepository.create({
      type: ConversationType.GROUP,
      name,
      avatarUrl: avatarUrl || null,
      createdById: userId,
    });

    await this.conversationRepository.save(conversation);

    // 将创建者添加为群主
    const owner = this.conversationUserRepository.create({
      conversationId: conversation.id,
      userId: userId,
      role: MemberRole.OWNER,
    });

    // 添加其他成员
    const members = memberIds.map(memberId =>
      this.conversationUserRepository.create({
        conversationId: conversation.id,
        userId: memberId,
        role: MemberRole.MEMBER,
      })
    );

    await this.conversationUserRepository.save([owner, ...members]);

    // 获取创建者和成员的用户名
    const creatorUser = users.find(u => u.id === userId);
    const memberUsers = users.filter(u => memberIds.includes(u.id));

    // 创建系统消息：群组已创建
    let systemMessageContent = `${creatorUser?.username || "用户"} 创建了群聊`;
    if (memberUsers.length > 0) {
      const memberNames = memberUsers.map(u => u.username).join("、");
      systemMessageContent += ` 并邀请 ${memberNames} 加入群聊`;
    }

    await this.systemMessageCreator.createSystemMessage(conversation.id, systemMessageContent, userId);

    return conversation;
  }

  /**
   * 获取会话详情
   */
  public async getConversation(
    conversationId: string,
    userId: string
  ): Promise<Conversation> {
    // 验证用户是否为会话成员
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
   * 删除会话（仅对当前用户）
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

    // 获取最后一条消息以标记为已读
    const lastMessage = await this.messageRepository.findOne({
      where: {
        conversationId,
        deletedAt: IsNull(),
      },
      order: { createdAt: "DESC" },
    });

    const now = new Date();
    // 软删除：设置 deletedAt 隐藏会话，设置 hiddenUntil 记录删除时间
    // hiddenUntil 用于过滤旧消息，仅显示删除后的消息
    // 同时标记所有消息为已读，避免会话重新创建时显示旧的未读数
    member.deletedAt = now;
    member.hiddenUntil = now;
    member.lastReadMessageId = lastMessage?.id || null;
    await this.conversationUserRepository.save(member);
  }

  /**
   * 标记会话消息为已读
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
      // 获取最新消息（来自其他用户）
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

    // 原始逻辑：标记特定消息
    const message = await this.messageRepository.findOne({
      where: { id: messageId, conversationId },
    });

    if (!message) {
      throw new NotFoundError("消息未找到");
    }

    // 仅在新消息更晚时更新
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
   * 切换会话置顶/取消置顶
   */
  public async togglePin(conversationId: string, userId: string): Promise<void> {
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    // 如果置顶，检查置顶数量限制（从配置中获取最大值）
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
   * 设置会话免打扰
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

    // 如果提供了时长，计算免打扰结束时间；否则永久免打扰
    if (duration && duration > 0) {
      const mutedUntil = new Date();
      mutedUntil.setSeconds(mutedUntil.getSeconds() + duration);
      member.mutedUntil = mutedUntil;
    } else {
      // 永久免打扰：设置为 MySQL TIMESTAMP 最大值（2038-01-19）
      member.mutedUntil = new Date(SPECIAL_DATES.MYSQL_TIMESTAMP_MAX);
    }

    await this.conversationUserRepository.save(member);
  }

  /**
   * 取消会话免打扰
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
   * 更新群组名称
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
   * 更新群组头像
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
   * 获取未读消息数（私有辅助方法）
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

    // 如果会话已隐藏（已删除），仅计算 hiddenUntil 之后的消息
    if (member.hiddenUntil) {
      // 获取 hiddenUntil 之后的所有消息
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

      // 如果没有 lastReadMessageId，返回 hiddenUntil 之后的所有消息数
      if (!member.lastReadMessageId) {
        return allMessages.length;
      }

      // 在列表中查找 lastReadMessage 的位置
      const lastReadIndex = allMessages.findIndex(msg => msg.id === member.lastReadMessageId);

      if (lastReadIndex === -1) {
        // lastReadMessage 不在 hiddenUntil 之后的列表中，返回所有消息数
        return allMessages.length;
      }

      // 返回 lastReadMessage 之后的消息数
      return allMessages.length - lastReadIndex - 1;
    }

    if (!member.lastReadMessageId) {
      // 如果没有已读消息，返回所有消息数（排除自己的消息）
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
      // 如果 lastReadMessageId 存在但消息已删除，返回 0
      return 0;
    }

    // 获取会话中所有未删除的消息，按时间排序
    const allMessages = await this.messageRepository
      .createQueryBuilder("message")
      .where("message.conversationId = :conversationId", { conversationId })
      .andWhere("message.senderId != :userId", { userId })
      .andWhere("message.deletedAt IS NULL")
      .orderBy("message.createdAt", "ASC")
      .addOrderBy("message.id", "ASC")
      .getMany();

    // 在列表中查找 lastReadMessage 的位置
    const lastReadIndex = allMessages.findIndex(msg => msg.id === member.lastReadMessageId);

    if (lastReadIndex === -1) {
      // lastReadMessage 不在列表中（可能是自己的消息或已删除），返回所有消息数
      return allMessages.length;
    }

    // 返回 lastReadMessage 之后的消息数
    return allMessages.length - lastReadIndex - 1;
  }
}

export default new ConversationCoreService();
