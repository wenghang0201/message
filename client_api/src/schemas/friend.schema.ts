import * as yup from "yup";

/**
 * 发送好友请求验证
 */
export const sendFriendRequestSchema = yup.object({
  recipientId: yup.string().uuid("Invalid recipient ID").required("Recipient ID is required"),
});

export type SendFriendRequestDto = yup.InferType<typeof sendFriendRequestSchema>;
