import { Router } from "express";
import messageController from "../controllers/message.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { validateBody, validateQuery, validateParams } from "../middleware/validation.middleware";
import {
  sendMessageSchema,
  updateMessageSchema,
  batchDeleteMessagesSchema,
  getMessagesQuerySchema,
  messageIdParamSchema,
  conversationIdParamSchema,
} from "../schemas/message.schema";

/**
 * 消息路由
 */
class MessageRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // 所有消息路由都需要认证
    this.router.use(authenticateToken);

    // 发送消息
    this.router.post(
      "/messages",
      validateBody(sendMessageSchema),
      messageController.sendMessage.bind(messageController)
    );

    // 获取对话消息列表
    this.router.get(
      "/conversations/:conversationId/messages",
      validateParams(conversationIdParamSchema),
      validateQuery(getMessagesQuerySchema),
      messageController.getMessages.bind(messageController)
    );

    // 获取单条消息
    this.router.get(
      "/messages/:messageId",
      validateParams(messageIdParamSchema),
      messageController.getMessage.bind(messageController)
    );

    // 编辑消息
    this.router.put(
      "/messages/:messageId",
      validateParams(messageIdParamSchema),
      validateBody(updateMessageSchema),
      messageController.updateMessage.bind(messageController)
    );

    // 删除消息
    this.router.delete(
      "/messages/:messageId",
      validateParams(messageIdParamSchema),
      messageController.deleteMessage.bind(messageController)
    );

    // 批量删除消息
    this.router.post(
      "/messages/batch-delete",
      validateBody(batchDeleteMessagesSchema),
      messageController.batchDeleteMessages.bind(messageController)
    );

    // 撤回消息
    this.router.post(
      "/messages/:messageId/recall",
      validateParams(messageIdParamSchema),
      messageController.recallMessage.bind(messageController)
    );
  }
}

export default new MessageRoutes().router;
