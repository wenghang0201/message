import { Repository, IsNull } from "typeorm";
import { Message } from "../models/Message.entity";
import { Conversation, ConversationType } from "../models/Conversation.entity";
import { ConversationUser } from "../models/ConversationUser.entity";
import { Friend, FriendStatus } from "../models/Friend.entity";
import { AppDataSource } from "../config/database";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../utils/app-error.util";
import { SendMessageDto } from "../schemas/message.schema";
import conversationService from "./conversation.service";
import { MESSAGE_LIMITS } from "../constants/business.config";

/**
 * 消息服务
 */
export class MessageService {
  private messageRepository: Repository<Message>;
  private conversationRepository: Repository<Conversation>;
  private conversationUserRepository: Repository<ConversationUser>;
  private friendRepository: Repository<Friend>;

  constructor() {
    this.messageRepository = AppDataSource.getRepository(Message);
    this.conversationRepository = AppDataSource.getRepository(Conversation);
    this.conversationUserRepository =
      AppDataSource.getRepository(ConversationUser);
    this.friendRepository = AppDataSource.getRepository(Friend);
  }

  /**
   * 获取对话的所有活跃成员ID（排除已退出的成员）
   */
  public async getConversationMemberIds(conversationId: string): Promise<string[]> {
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ['userId'],
    });
    return members.map(m => m.userId);
  }

  /**
   * 发送消息
   */
  public async sendMessage(
    userId: string,
    data: SendMessageDto
  ): Promise<{ message: Message; restoredUserIds: string[] }> {
    const { conversationId, type, content, replyToMessageId, isForwarded} = data;

    // 验证用户是否是对话的活跃成员（排除已退出的成员）
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId, deletedAt: IsNull() },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    // 验证对话是否存在
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundError("会话未找到");
    }

    // 如果是单聊，验证发送者和接收者是否是好友
    if (conversation.type === ConversationType.SINGLE) {
      // 获取对话中的另一个用户
      const conversationMembers = await this.conversationUserRepository.find({
        where: { conversationId },
        select: ['userId'],
      });

      const otherUserId = conversationMembers.find(m => m.userId !== userId)?.userId;

      if (otherUserId) {
        // 检查是否存在已接受的好友关系（双向查询）
        const friendship = await this.friendRepository.findOne({
          where: [
            { requesterId: userId, recipientId: otherUserId, status: FriendStatus.ACCEPTED },
            { requesterId: otherUserId, recipientId: userId, status: FriendStatus.ACCEPTED },
          ],
        });

        if (!friendship) {
          throw new ForbiddenError("只能向好友发送消息");
        }
      }
    } else if (conversation.type === ConversationType.GROUP) {
      // 如果是群聊，检查消息发送权限
      const canSend = await conversationService.canSendMessage(conversationId, userId);
      if (!canSend) {
        throw new ForbiddenError("您没有在此群组发送消息的权限");
      }
    }

    // 如果是回复消息，验证被回复的消息是否存在
    if (replyToMessageId) {
      const replyToMessage = await this.messageRepository.findOne({
        where: { id: replyToMessageId, conversationId },
      });

      if (!replyToMessage) {
        throw new ValidationError("回复的消息未找到");
      }
    }

    // 自动恢复所有成员的软删除状态（如果有的话）
    // 这样当任何成员发送新消息时，所有之前删除了对话的成员都能重新看到它
    // 注意：我们只清除deletedAt，保留hiddenUntil，这样用户只能看到恢复后的新消息
    // 对于群聊，不自动恢复已退出的成员（退出是主动行为，不应该因为新消息而重新加入）
    const restoredUserIds: string[] = [];

    if (conversation.type === ConversationType.SINGLE) {
      // 只对单聊进行自动恢复
      const allMembers = await this.conversationUserRepository.find({
        where: { conversationId },
      });

      const membersToRestore = allMembers.filter(m => m.deletedAt !== null);

      if (membersToRestore.length > 0) {
        membersToRestore.forEach(m => {
          m.deletedAt = null; // 清除deletedAt，使对话重新可见
          // 保留hiddenUntil不变，以便过滤旧消息
          restoredUserIds.push(m.userId);
        });
        await this.conversationUserRepository.save(membersToRestore);
      }
    }

    // 创建消息
    const message = this.messageRepository.create({
      conversationId,
      senderId: userId,
      type,
      content,
      replyToMessageId,
      isForwarded: isForwarded || false,
    });

    await this.messageRepository.save(message);

    // 更新对话的更新时间
    conversation.updatedAt = new Date();
    await this.conversationRepository.save(conversation);

    return { message, restoredUserIds };
  }

  /**
   * 获取对话消息列表（分页）- 优化版，减少N+1查询
   */
  public async getMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = MESSAGE_LIMITS.DEFAULT_PAGE_SIZE
  ): Promise<{ messages: Message[]; total: number; hasMore: boolean }> {
    // 验证用户是否是对话成员（允许已移除的成员查看历史消息）
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId, userId },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    const skip = (page - 1) * limit;

    // 构建查询条件：排除已删除的消息，以及用户hiddenUntil之前的消息
    const queryBuilder = this.messageRepository
      .createQueryBuilder("message")
      .where("message.conversationId = :conversationId", { conversationId })
      .andWhere("message.deletedAt IS NULL");

    // 如果用户有hiddenUntil时间，只显示该时间之后的消息
    if (member.hiddenUntil) {
      queryBuilder.andWhere("message.createdAt > :hiddenUntil", {
        hiddenUntil: member.hiddenUntil,
      });
    }

    // 如果用户已被移除（deletedAt不为空），只显示移除之前的消息
    if (member.deletedAt) {
      queryBuilder.andWhere("message.createdAt <= :deletedAt", {
        deletedAt: member.deletedAt,
      });
    }

    // 获取消息总数
    const total = await queryBuilder.getCount();

    // 获取消息（按时间倒序），同时使用eager loading加载已读状态和发送者信息
    // 这样可以避免N+1查询问题
    const messages = await queryBuilder
      .leftJoinAndSelect("message.statuses", "status")
      .leftJoinAndSelect("message.sender", "sender")
      .leftJoinAndSelect("sender.profile", "senderProfile")
      .orderBy("message.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getMany();

    // 反转消息顺序（最旧的在前）
    messages.reverse();

    const hasMore = skip + messages.length < total;

    return {
      messages,
      total,
      hasMore,
    };
  }

  /**
   * 编辑消息
   */
  public async updateMessage(
    messageId: string,
    userId: string,
    content: string
  ): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundError("消息未找到");
    }

    if (message.senderId !== userId) {
      throw new ForbiddenError("您只能编辑自己的消息");
    }

    if (message.deletedAt) {
      throw new ValidationError("无法编辑已删除的消息");
    }

    message.content = content;
    message.editedAt = new Date();

    await this.messageRepository.save(message);

    return message;
  }

  /**
   * 删除消息（软删除）
   */
  public async deleteMessage(
    messageId: string,
    userId: string
  ): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundError("消息未找到");
    }

    if (message.senderId !== userId) {
      throw new ForbiddenError("您只能删除自己的消息");
    }

    message.deletedAt = new Date();
    await this.messageRepository.save(message);

    return message;
  }

  /**
   * 批量删除消息
   */
  public async batchDeleteMessages(
    messageIds: string[],
    userId: string
  ): Promise<{ deletedCount: number; deletedMessages: Message[] }> {
    const deletedMessages: Message[] = [];

    for (const messageId of messageIds) {
      const message = await this.messageRepository.findOne({
        where: { id: messageId },
      });

      if (!message) {
        continue; // 如果找不到消息则跳过
      }

      if (message.senderId !== userId) {
        throw new ForbiddenError("您只能删除自己的消息");
      }

      // 检查5分钟时间限制
      const now = new Date();
      const diffMinutes = (now.getTime() - message.createdAt.getTime()) / 1000 / 60;

      if (diffMinutes > 5) {
        throw new ValidationError(`信息 ${messageId} 超过5分钟无法删除`);
      }

      message.deletedAt = new Date();
      await this.messageRepository.save(message);
      deletedMessages.push(message);
    }

    return {
      deletedCount: deletedMessages.length,
      deletedMessages,
    };
  }

  /**
   * 撤回消息
   */
  public async recallMessage(
    messageId: string,
    userId: string
  ): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundError("消息未找到");
    }

    if (message.senderId !== userId) {
      throw new ForbiddenError("您只能撤回自己的消息");
    }

    // 检查5分钟时间限制
    const now = new Date();
    const diffMinutes = (now.getTime() - message.createdAt.getTime()) / 1000 / 60;

    if (diffMinutes > 5) {
      throw new ValidationError("消息超过5分钟无法撤回");
    }

    // 标记为已删除（目前与删除相同）
    message.deletedAt = new Date();
    await this.messageRepository.save(message);

    return message;
  }

  /**
   * 获取单条消息
   */
  public async getMessage(
    messageId: string,
    userId: string
  ): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ["conversation"],
    });

    if (!message) {
      throw new NotFoundError("消息未找到");
    }

    // 验证用户是否是对话成员
    const member = await this.conversationUserRepository.findOne({
      where: { conversationId: message.conversationId, userId },
    });

    if (!member) {
      throw new ForbiddenError("您不是此会话的成员");
    }

    return message;
  }
}

export default new MessageService();
