import { Repository, IsNull } from "typeorm";
import { Conversation, ConversationType, MessageSendPermission, MemberAddPermission } from "../models/Conversation.entity";
import { ConversationUser, MemberRole } from "../models/ConversationUser.entity";
import { Message, MessageType } from "../models/Message.entity";
import { MessageStatus, DeliveryStatus } from "../models/MessageStatus.entity";
import { User } from "../models/User.entity";
import { UserProfile } from "../models/UserProfile.entity";
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

/**
 * 对话服务
 */
export class ConversationService {
  private conversationRepository: Repository<Conversation>;
  private conversationUserRepository: Repository<ConversationUser>;
  private messageRepository: Repository<Message>;
  private messageStatusRepository: Repository<MessageStatus>;
  private userRepository: Repository<User>;
  private userProfileRepository: Repository<UserProfile>;
  private friendRepository: Repository<Friend>;

  constructor() {
    this.conversationRepository = AppDataSource.getRepository(Conversation);
    this.conversationUserRepository =
      AppDataSource.getRepository(ConversationUser);
    this.messageRepository = AppDataSource.getRepository(Message);
    this.messageStatusRepository = AppDataSource.getRepository(MessageStatus);
    this.userRepository = AppDataSource.getRepository(User);
    this.userProfileRepository = AppDataSource.getRepository(UserProfile);
    this.friendRepository = AppDataSource.getRepository(Friend);
  }

  /**
   * 创建系统消息
   */
  private async createSystemMessage(
    conversationId: string,
    content: string,
    senderId: string = "system",
    excludeUserId?: string
  ): Promise<Message> {
    const message = this.messageRepository.create({
      conversationId,
      senderId,
      type: "system" as any,
      content,
      isForwarded: false,
    });

    await this.messageRepository.save(message);

    // 获取所有群成员ID
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ['userId'],
    });

    // 通过 WebSocket 广播系统消息给所有成员（排除指定用户）
    members.forEach(member => {
      // 跳过被排除的用户
      if (excludeUserId && member.userId === excludeUserId) {
        return;
      }

      websocketService.sendMessageToUser(member.userId, WebSocketEvent.NEW_MESSAGE, {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        type: message.type,
        content: message.content,
        createdAt: message.createdAt,
        isForwarded: message.isForwarded,
        editedAt: message.editedAt,
        replyToMessageId: message.replyToMessageId,
      });
    });

    return message;
  }

  /**
   * 获取用户的所有对话列表
   */
  public async getUserConversations(
    userId: string
  ): Promise<ConversationListItem[]> {
    // 获取用户参与的所有对话（排除已删除的）
    const conversationUsers = await this.conversationUserRepository.find({
      where: { userId, deletedAt: IsNull() },
      relations: ["conversation"],
      order: { conversation: { updatedAt: "DESC" } },
    });

    const conversations: ConversationListItem[] = [];

    for (const cu of conversationUsers) {
      const conversation = cu.conversation;

      let name = conversation.name || "";
      let avatar = conversation.avatarUrl || null;
      let otherUserId: string | undefined;
      let isOnline: boolean | undefined;
      let lastSeenAt: Date | null | undefined;

      // 单聊：获取对方用户信息
      if (conversation.type === ConversationType.SINGLE) {
        const participants = await this.conversationUserRepository.find({
          where: { conversationId: conversation.id },
          relations: ["user", "user.profile"],
        });

        const otherParticipant = participants.find(p => p.userId !== userId);

        if (otherParticipant) {
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

      // 获取最后一条消息（排除用户隐藏时间之前的消息）
      const queryBuilder = this.messageRepository
        .createQueryBuilder("message")
        .where("message.conversationId = :conversationId", { conversationId: conversation.id })
        .andWhere("message.deletedAt IS NULL");

      // 如果用户有hiddenUntil时间，只显示该时间之后的消息
      if (cu.hiddenUntil) {
        queryBuilder.andWhere("message.createdAt > :hiddenUntil", {
          hiddenUntil: cu.hiddenUntil,
        });
      }

      const lastMessage = await queryBuilder
        .orderBy("message.createdAt", "DESC")
        .getOne();

      // 计算未读数
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
   * 创建群聊
   */
  public async createGroupConversation(
    userId: string,
    name: string,
    memberIds: string[],
    avatarUrl?: string | null
  ): Promise<Conversation> {
    // 验证所有成员用户存在
    const allUserIds = [userId, ...memberIds];
    const users = await this.userRepository.find({
      where: allUserIds.map(id => ({ id })),
    });

    if (users.length !== allUserIds.length) {
      throw new NotFoundError("一个或多个用户未找到");
    }

    // 创建群聊对话
    const conversation = this.conversationRepository.create({
      type: ConversationType.GROUP,
      name,
      avatarUrl: avatarUrl || null,
      createdById: userId,
    });

    await this.conversationRepository.save(conversation);

    // 添加创建者为群主
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

    // 创建系统消息：群组创建
    let systemMessageContent = `${creatorUser?.username || "用户"} 创建了群聊`;
    if (memberUsers.length > 0) {
      const memberNames = memberUsers.map(u => u.username).join("、");
      systemMessageContent += ` 并邀请 ${memberNames} 加入群聊`;
    }

    await this.createSystemMessage(conversation.id, systemMessageContent, userId);

    return conversation;
  }

  /**
   * 创建或获取单聊对话
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

    // 验证是否是好友关系
    const friendship = await this.friendRepository.findOne({
      where: [
        { requesterId: userId, recipientId: otherUserId, status: FriendStatus.ACCEPTED },
        { requesterId: otherUserId, recipientId: userId, status: FriendStatus.ACCEPTED },
      ],
    });

    if (!friendship) {
      throw new ForbiddenError("只能与好友创建对话");
    }

    // 查找是否已存在单聊对话（包括已删除的）
    const userConversations = await this.conversationUserRepository.find({
      where: { userId },
      relations: ["conversation"],
    });

    for (const uc of userConversations) {
      if (uc.conversation.type === ConversationType.SINGLE) {
        // 检查是否包含对方用户
        const members = await this.conversationUserRepository.find({
          where: { conversationId: uc.conversationId },
        });

        const otherMember = members.find(m => m.userId === otherUserId);
        if (otherMember) {
          // 如果对话存在但被软删除，只恢复当前用户的访问权限
          // 对方用户的对话保持隐藏状态，直到收到第一条消息时自动恢复
          if (uc.deletedAt !== null) {
            uc.deletedAt = null;
            await this.conversationUserRepository.save(uc);
            // 对于发起恢复的用户，将其视为新会话
            return { conversation: uc.conversation, isNew: true };
          }

          return { conversation: uc.conversation, isNew: false };
        }
      }
    }

    // 创建新的单聊对话
    const conversation = this.conversationRepository.create({
      type: ConversationType.SINGLE,
      createdById: userId,
    });

    await this.conversationRepository.save(conversation);

    // 添加两个用户到对话
    // 创建者立即可见对话
    const user1 = this.conversationUserRepository.create({
      conversationId: conversation.id,
      userId: userId,
      role: MemberRole.MEMBER,
    });

    // 对方用户暂时隐藏对话，直到收到第一条消息时自动恢复
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
   * 获取对话详情
   */
  public async getConversation(
    conversationId: string,
    userId: string
  ): Promise<Conversation> {
    // 验证用户是否是对话成员
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
   * 删除对话（仅对当前用户）
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

    // 获取最后一条消息，用于标记已读
    const lastMessage = await this.messageRepository.findOne({
      where: {
        conversationId,
        deletedAt: IsNull(),
      },
      order: { createdAt: "DESC" },
    });

    const now = new Date();
    // 软删除：设置deletedAt隐藏对话，设置hiddenUntil记录删除时间点
    // hiddenUntil用于过滤旧消息，只显示删除后的新消息
    // 同时标记所有消息为已读，避免重新创建对话时仍显示旧的未读数
    member.deletedAt = now;
    member.hiddenUntil = now;
    member.lastReadMessageId = lastMessage?.id || null;
    await this.conversationUserRepository.save(member);
  }

  /**
   * 标记对话消息为已读
   */
  public async markAsRead(
    conversationId: string,
    userId: string,
    messageId: string
  ): Promise<void> {
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    // 验证消息存在
    const message = await this.messageRepository.findOne({
      where: { id: messageId, conversationId },
    });

    if (!message) {
      throw new NotFoundError("消息未找到");
    }

    // 更新 lastReadMessageId
    member.lastReadMessageId = messageId;
    await this.conversationUserRepository.save(member);

    // 创建或更新消息状态记录
    let status = await this.messageStatusRepository.findOne({
      where: { messageId, userId },
    });

    if (status) {
      // 更新现有状态为已读
      status.status = DeliveryStatus.READ;
      status.timestamp = new Date();
    } else {
      // 创建新的已读状态记录
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
      const query = this.messageRepository
        .createQueryBuilder("message")
        .where("message.conversationId = :conversationId", { conversationId })
        .andWhere("message.senderId != :userId", { userId })
        .andWhere("message.deletedAt IS NULL")
        .andWhere("message.createdAt > :hiddenUntil", {
          hiddenUntil: member.hiddenUntil,
        });

      // 如果有lastReadMessageId，还要排除已读的消息
      if (member.lastReadMessageId) {
        const lastReadMessage = await this.messageRepository.findOne({
          where: { id: member.lastReadMessageId },
        });

        if (lastReadMessage) {
          query.andWhere("message.createdAt > :lastReadAt", {
            lastReadAt: lastReadMessage.createdAt,
          });
        }
      }

      return await query.getCount();
    }

    if (!member.lastReadMessageId) {
      // 如果没有已读消息，返回所有消息数（排除自己发的）
      return await this.messageRepository
        .createQueryBuilder("message")
        .where("message.conversationId = :conversationId", { conversationId })
        .andWhere("message.senderId != :userId", { userId })
        .andWhere("message.deletedAt IS NULL")
        .getCount();
    }

    // 获取最后已读消息
    const lastReadMessage = await this.messageRepository.findOne({
      where: { id: member.lastReadMessageId },
    });

    if (!lastReadMessage) {
      return 0;
    }

    // 获取所有未读消息（创建时间晚于已读消息，或同时间但不是已读消息本身）
    const allMessages = await this.messageRepository
      .createQueryBuilder("message")
      .where("message.conversationId = :conversationId", { conversationId })
      .andWhere("message.senderId != :userId", { userId })
      .andWhere("message.deletedAt IS NULL")
      .andWhere("message.createdAt > :lastReadAt", {
        lastReadAt: lastReadMessage.createdAt,
      })
      .getMany();

    // 手动过滤掉已读消息本身和它之前的消息
    const unreadMessages = allMessages.filter(msg => {
      // 如果是已读消息本身，跳过
      if (msg.id === member.lastReadMessageId) {
        return false;
      }
      // 如果创建时间晚于已读消息，算未读
      if (msg.createdAt > lastReadMessage.createdAt) {
        return true;
      }
      // 如果创建时间相同，需要确保不是已读消息本身
      return msg.createdAt.getTime() === lastReadMessage.createdAt.getTime() && msg.id !== member.lastReadMessageId;
    });

    return unreadMessages.length;
  }

  /**
   * 获取群聊成员列表
   */
  public async getGroupMembers(conversationId: string, userId: string) {
    // 验证会话是否存在 and user is a member
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

    // 获取所有成员
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      relations: ["user", "user.profile"],
      order: { role: "DESC", joinedAt: "ASC" },
    });

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
    targetMember.hiddenUntil = new Date('2099-12-31');
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

    // 如果要置顶，检查置顶数量限制（最多5个）
    if (!member.isPinned) {
      const pinnedCount = await this.conversationUserRepository.count({
        where: { userId, isPinned: true, deletedAt: IsNull() },
      });

      if (pinnedCount >= 5) {
        throw new ValidationError("最多只能置顶5个聊天");
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
      // 永久静音：设置为MySQL TIMESTAMP的最大值 (2038-01-19)
      member.mutedUntil = new Date('2038-01-19 03:14:07');
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
   */
  public async canSendMessage(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      return false;
    }

    // 检查群组是否已解散
    if (conversation.disbandedAt) {
      return false;
    }

    // 单聊总是允许发送
    if (conversation.type === ConversationType.SINGLE) {
      return true;
    }

    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!membership) {
      return false;
    }

    // 检查消息发送权限
    switch (conversation.messageSendPermission) {
      case MessageSendPermission.ALL_MEMBERS:
        return true;
      case MessageSendPermission.ADMIN_ONLY:
        return membership.role === MemberRole.ADMIN || membership.role === MemberRole.OWNER;
      case MessageSendPermission.OWNER_ONLY:
        return membership.role === MemberRole.OWNER;
      default:
        return true;
    }
  }

  /**
   * 检查用户是否有添加成员的权限
   */
  public async canAddMember(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      return false;
    }

    if (conversation.type !== ConversationType.GROUP) {
      return false;
    }

    const membership = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!membership) {
      return false;
    }

    // 检查成员添加权限
    switch (conversation.memberAddPermission) {
      case MemberAddPermission.ALL_MEMBERS:
        return true;
      case MemberAddPermission.ADMIN_ONLY:
        return membership.role === MemberRole.ADMIN || membership.role === MemberRole.OWNER;
      case MemberAddPermission.OWNER_ONLY:
        return membership.role === MemberRole.OWNER;
      default:
        return membership.role === MemberRole.ADMIN || membership.role === MemberRole.OWNER;
    }
  }
}

export default new ConversationService();
