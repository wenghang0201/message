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
 * 类型定义
 */
export type SendMessageDto = yup.InferType<typeof sendMessageSchema>;
export type UpdateMessageDto = yup.InferType<typeof updateMessageSchema>;
