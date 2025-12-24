/**
 * System Message Creator Utility
 * Centralizes system message creation logic
 *
 * This utility eliminates duplicate system message creation logic
 * that appears in 4+ methods throughout ConversationService.
 *
 * System messages are used for:
 * - Member joined group
 * - Member left group
 * - Member removed from group
 * - Group name/avatar changed
 * - Group disbanded
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
   * Create and broadcast system message to conversation members
   *
   * @param conversationId - ID of the conversation
   * @param content - Message content (e.g., "User joined the group")
   * @param senderId - Sender ID (defaults to "system")
   * @param excludeUserId - Optional user ID to exclude from broadcast
   * @returns Created message
   */
  async createSystemMessage(
    conversationId: string,
    content: string,
    senderId: string = 'system',
    excludeUserId?: string
  ): Promise<Message> {
    // Create system message
    const message = this.messageRepository.create({
      conversationId,
      senderId,
      type: 'system' as any,
      content,
      isForwarded: false,
    });

    await this.messageRepository.save(message);

    // Get all conversation members
    const members = await this.conversationUserRepository.find({
      where: { conversationId, deletedAt: IsNull() },
      select: ['userId'],
    });

    // Broadcast to all members except excluded user
    members.forEach(member => {
      // Skip excluded user
      if (excludeUserId && member.userId === excludeUserId) {
        return;
      }

      // Send WebSocket event to user
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
