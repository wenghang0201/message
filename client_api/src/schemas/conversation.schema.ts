import * as yup from "yup";

/**
 * 创建单聊对话
 */
export const createSingleConversationSchema = yup.object({
  otherUserId: yup
    .string()
    .required("Other user ID is required")
    .uuid("Invalid user ID format"),
});

/**
 * 标记消息为已读
 * messageId 可选 - 如果不提供则标记所有消息为已读
 */
export const markAsReadSchema = yup.object({
  messageId: yup
    .string()
    .uuid("Invalid message ID format")
    .optional()
    .nullable(),
});

/**
 * 创建群聊
 */
export const createGroupConversationSchema = yup.object({
  name: yup
    .string()
    .required("Group name is required")
    .min(1, "Group name must be at least 1 character")
    .max(100, "Group name must be at most 100 characters"),
  memberIds: yup
    .array()
    .of(yup.string().uuid("Invalid user ID format"))
    .required("Member IDs are required")
    .min(1, "At least one member is required"),
  avatarUrl: yup.string().url("Invalid avatar URL").optional().nullable(),
});

/**
 * 类型定义
 */
/**
 * 更新群聊名称
 */
export const updateGroupNameSchema = yup.object({
  name: yup
    .string()
    .required("Group name is required")
    .min(1, "Group name must be at least 1 character")
    .max(100, "Group name must be at most 100 characters"),
});

/**
 * 更新群聊头像
 */
export const updateGroupAvatarSchema = yup.object({
  avatarUrl: yup
    .string()
    .required("Avatar URL is required")
    .url("Invalid avatar URL"),
});

/**
 * 类型定义
 */
/**
 * 更新消息发送权限
 */
export const updateMessageSendPermissionSchema = yup.object({
  permission: yup
    .string()
    .required("Permission is required")
    .oneOf(["all_members", "admin_only", "owner_only"], "Invalid permission value"),
});

/**
 * 更新成员添加权限
 */
export const updateMemberAddPermissionSchema = yup.object({
  permission: yup
    .string()
    .required("Permission is required")
    .oneOf(["all_members", "admin_only", "owner_only"], "Invalid permission value"),
});

/**
 * 更新入群验证设置
 */
export const updateRequireApprovalSchema = yup.object({
  requireApproval: yup
    .boolean()
    .required("Require approval setting is required"),
});

/**
 * 转让群主
 */
export const transferOwnershipSchema = yup.object({
  newOwnerId: yup
    .string()
    .required("New owner ID is required")
    .uuid("Invalid user ID format"),
});

export type CreateSingleConversationDto = yup.InferType<
  typeof createSingleConversationSchema
>;
export type MarkAsReadDto = yup.InferType<typeof markAsReadSchema>;
export type CreateGroupConversationDto = yup.InferType<
  typeof createGroupConversationSchema
>;
export type UpdateGroupNameDto = yup.InferType<typeof updateGroupNameSchema>;
export type UpdateGroupAvatarDto = yup.InferType<typeof updateGroupAvatarSchema>;
export type UpdateMessageSendPermissionDto = yup.InferType<typeof updateMessageSendPermissionSchema>;
export type UpdateMemberAddPermissionDto = yup.InferType<typeof updateMemberAddPermissionSchema>;
export type UpdateRequireApprovalDto = yup.InferType<typeof updateRequireApprovalSchema>;
export type TransferOwnershipDto = yup.InferType<typeof transferOwnershipSchema>;
