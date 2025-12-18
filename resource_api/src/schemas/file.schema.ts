import * as yup from "yup";

/**
 * 加密密钥验证模式
 */
export const encryptedKeySchema = yup.object({
  recipientId: yup
    .string()
    .required("Recipient ID is required"),
  encryptedKey: yup
    .string()
    .required("Encrypted key is required")
    .min(1, "Encrypted key cannot be empty"),
}).required();

/**
 * 文件元数据验证模式
 */
export const fileMetadataSchema = yup.object({
  originalSize: yup
    .number()
    .notRequired()
    .positive("Original size must be a positive number"),
  mimeType: yup
    .string()
    .notRequired()
    .max(100, "MIME type must not exceed 100 characters"),
});

/**
 * 上传加密文件验证模式
 */
export const uploadEncryptedFileSchema = yup.object({
  encryptedFile: yup
    .string()
    .required("Encrypted file is required")
    .min(1, "Encrypted file cannot be empty"),
  encryptedKeys: yup
    .array()
    .of(encryptedKeySchema)
    .required("Encrypted keys are required")
    .min(1, "At least one encrypted key is required"),
  metadata: fileMetadataSchema.notRequired(),
});

/**
 * 类型定义
 */
export type EncryptedKeyDto = yup.InferType<typeof encryptedKeySchema>;
export type FileMetadataDto = yup.InferType<typeof fileMetadataSchema>;
export type UploadEncryptedFileDto = yup.InferType<typeof uploadEncryptedFileSchema>;
