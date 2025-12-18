import * as yup from "yup";
import { MessageType } from "../models/Message.entity";

/**
 * 发送消息
 */
export const sendMessageSchema = yup.object({
  conversationId: yup
    .string()
    .required("Conversation ID is required")
    .uuid("Invalid conversation ID format"),
  type: yup
    .string()
    .required("Message type is required")
    .oneOf(
      Object.values(MessageType),
      "Invalid message type"
    ),
  content: yup
    .string()
    .required("Content is required")
    .max(10000, "Content too long"),
  thumbnail: yup.string().url("Invalid thumbnail URL").optional(),
  duration: yup.number().positive("Duration must be positive").optional(),
  replyToMessageId: yup
    .string()
    .uuid("Invalid reply message ID format")
    .optional(),
  isForwarded: yup.boolean().optional(),
});

/**
 * 更新消息
 */
export const updateMessageSchema = yup.object({
  content: yup
    .string()
    .required("Content is required")
    .max(10000, "Content too long"),
});

/**
 * 批量删除消息
 */
export const batchDeleteMessagesSchema = yup.object({
  messageIds: yup
    .array()
    .of(yup.string().uuid("Invalid message ID format").required())
    .min(1, "At least one message ID is required")
    .max(100, "Cannot delete more than 100 messages at once")
    .required("Message IDs are required"),
});

/**
 * 获取消息分页参数
 */
export const getMessagesQuerySchema = yup.object({
  page: yup
    .number()
    .integer("Page must be an integer")
    .positive("Page must be positive")
    .optional()
    .default(1),
  limit: yup
    .number()
    .integer("Limit must be an integer")
    .positive("Limit must be positive")
    .max(100, "Limit cannot exceed 100")
    .optional()
    .default(30),
});

/**
 * 消息ID参数
 */
export const messageIdParamSchema = yup.object({
  messageId: yup
    .string()
    .uuid("Invalid message ID format")
    .required("Message ID is required"),
});

/**
 * 对话ID参数
 */
export const conversationIdParamSchema = yup.object({
  conversationId: yup
    .string()
    .uuid("Invalid conversation ID format")
    .required("Conversation ID is required"),
});

/**
 * 类型定义
 */
export type SendMessageDto = yup.InferType<typeof sendMessageSchema>;
export type UpdateMessageDto = yup.InferType<typeof updateMessageSchema>;
export type BatchDeleteMessagesDto = yup.InferType<typeof batchDeleteMessagesSchema>;
export type GetMessagesQueryDto = yup.InferType<typeof getMessagesQuerySchema>;
