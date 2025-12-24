/**
 * 系统消息创建工具类
 * 集中系统消息创建逻辑
 *
 * 此工具类消除了 ConversationService 中 4+ 处重复的系统消息创建逻辑
 *
 * 系统消息用于：
 * - 成员加入群组
 * - 成员离开群组
 * - 成员被移除群组
 * - 群组名称/头像变更
 * - 群组解散
 */

import { Repository, IsNull } from 'typeorm';
import { Message } from '../models/Message.entity';
import { ConversationUser } from '../models/ConversationUser.entity';
import websocketService from '../services/websocket.service';
import { WebSocketEvent } from '../constants/websocket-events';

export class SystemMessageCreator {
  constructor(
    private messageRepository: Repository<Message>,
    private conversationUserRepository: Repository<ConversationUser>
  ) {}

  /**
   * 创建并广播系统消息给会话成员
   *
   * @param conversationId - 会话ID
   * @param content - 消息内容（例如："用户加入群组"）
   * @param senderId - 发送者ID（默认为 "system"）
   * @param excludeUserId - 可选的需要排除的用户ID
   * @returns 创建的消息
   */
  async createSystemMessage(
    conversationId: string,
    content: string,
    senderId: string = 'system',
    excludeUserId?: string
  ): Promise<Message> {
    // 创建系统消息
    const message = this.messageRepository.create({
      conversationId,
      senderId,
      type: 'system' as any,
      content,
      isForwarded: false,
    });

    await this.messageRepository.save(message);

    // 获取所有会话成员
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ['userId'],
    });

    // 广播给所有成员（排除指定用户）
    members.forEach(member => {
      // 跳过被排除的用户
      if (excludeUserId && member.userId === excludeUserId) {
        return;
      }

      // 发送WebSocket事件给用户
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
}
