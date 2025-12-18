import * as yup from "yup";

/**
 * 更新个人资料验证模式
 */
export const updateProfileSchema = yup.object({
  avatarUrl: yup.string().url("头像URL无效").nullable(),
  bio: yup.string().max(500, "个人简介不能超过500个字符").nullable(),
  phoneNumber: yup
    .string()
    .matches(/^[0-9+\-\s()]*$/, "电话号码格式无效")
    .max(20, "电话号码过长")
    .nullable(),
  statusMessage: yup.string().max(100, "状态消息不能超过100个字符").nullable(),
});

export type UpdateProfileDto = yup.InferType<typeof updateProfileSchema>;

/**
 * 更新隐私设置验证模式
 */
export const updatePrivacySchema = yup.object({
  showLastSeen: yup
    .string()
    .oneOf(["everyone", "friends", "nobody"], "无效的隐私选项"),
  showProfilePhoto: yup
    .string()
    .oneOf(["everyone", "friends", "nobody"], "无效的隐私选项"),
  showStatus: yup
    .string()
    .oneOf(["everyone", "friends", "nobody"], "无效的隐私选项"),
});

export type UpdatePrivacyDto = yup.InferType<typeof updatePrivacySchema>;

/**
 * 更新在线状态验证模式
 */
export const updateOnlineStatusSchema = yup.object({
  isOnline: yup.boolean().required("在线状态必填"),
});

export type UpdateOnlineStatusDto = yup.InferType<typeof updateOnlineStatusSchema>;
