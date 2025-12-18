import { Request, Response, NextFunction } from "express";
import messageService from "../services/message.service";
import { SendMessageDto } from "../schemas/message.schema";
import { ResponseUtil } from "../utils/response.util";
import websocketService from "../services/websocket.service";
import conversationService from "../services/conversation.service";
import { WebSocketEvent } from "../constants/websocket-events";

/**
 * 消息控制器
 */
export class MessageController {
  /**
   * 发送消息
   * POST /messages
   */
  public async sendMessage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const data = req.body as SendMessageDto;

      const result = await messageService.sendMessage(userId, data);
      const { message, restoredUserIds } = result;

      // 获取对话成员ID
      const memberIds = await messageService.getConversationMemberIds(data.conversationId);

      // 向会话参与者发送WebSocket事件（包括会话房间和用户房间）
      websocketService.sendMessageToConversation(data.conversationId, message, memberIds);

      // 如果有用户恢复了会话，向他们发送NEW_CONVERSATION事件
      // 使会话出现在他们的聊天列表中
      if (restoredUserIds.length > 0) {
        const conversation = await conversationService.getConversation(data.conversationId, userId);
        restoredUserIds.forEach(restoredUserId => {
          websocketService.sendMessageToUser(restoredUserId, WebSocketEvent.NEW_CONVERSATION, conversation);
        });
      }

      ResponseUtil.created(res, message, "消息已发送");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取对话消息列表
   * GET /conversations/:conversationId/messages
   */
  public async getMessages(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { conversationId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;

      const result = await messageService.getMessages(
        conversationId,
        userId,
        page,
        limit
      );

      ResponseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 编辑消息
   * PUT /messages/:messageId
   */
  public async updateMessage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { messageId } = req.params;
      const { content } = req.body;

      const message = await messageService.updateMessage(
        messageId,
        userId,
        content
      );

      ResponseUtil.success(res, message, "消息已更新");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 删除消息
   * DELETE /messages/:messageId
   */
  public async deleteMessage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { messageId } = req.params;

      const deletedMessage = await messageService.deleteMessage(messageId, userId);

      // 发送WebSocket事件通知会话参与者
      if (deletedMessage) {
        websocketService.notifyMessageDeleted(deletedMessage.conversationId, messageId);
      }

      ResponseUtil.success(res, undefined, "消息已删除");
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取单条消息
   * GET /messages/:messageId
   */
  public async getMessage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { messageId } = req.params;

      const message = await messageService.getMessage(messageId, userId);

      ResponseUtil.success(res, message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 批量删除消息
   * POST /messages/batch-delete
   */
  public async batchDeleteMessages(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { messageIds } = req.body;

      const result = await messageService.batchDeleteMessages(messageIds, userId);

      // 为每条删除的消息通知会话参与者
      result.deletedMessages.forEach(message => {
        websocketService.notifyMessageDeleted(message.conversationId, message.id);
      });

      ResponseUtil.success(res, undefined, `${result.deletedCount} messages deleted`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 撤回消息
   * POST /messages/:messageId/recall
   */
  public async recallMessage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const { messageId } = req.params;

      const message = await messageService.recallMessage(messageId, userId);

      // 通知会话参与者
      websocketService.notifyMessageRecalled(message.conversationId, messageId);

      ResponseUtil.success(res, message, "消息已撤回");
    } catch (error) {
      next(error);
    }
  }
}

export default new MessageController();
