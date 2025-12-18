import { Request, Response, NextFunction } from "express";
import { FileUploadError } from "../utils/app-error.util";

/**
 * 文件验证配置
 */
const FILE_CONFIG = {
  // 最大文件大小 (10MB)
  maxSize: 10 * 1024 * 1024,
  // 允许的文件类型
  allowedMimeTypes: [
    // 图片
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // 视频
    "video/mp4",
    "video/mpeg",
    "video/webm",
    "video/ogg",
    // 音频
    "audio/mp4",
    "audio/mpeg",
    "audio/webm",
    "audio/ogg",
    "audio/wav",
    "audio/x-m4a",
    // 文档
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ],
  // 允许的文件扩展名
  allowedExtensions: [
    // 图片
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    // 视频
    ".mp4",
    ".mpeg",
    ".webm",
    ".ogv",
    // 音频
    ".mp3",
    ".m4a",
    ".webm",
    ".ogg",
    ".oga",
    ".wav",
    // 文档
    ".pdf",
    ".doc",
    ".docx"
  ]
};

/**
 * 验证文件是否存在
 */
export function validateFileExists(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    throw new FileUploadError("未选择文件");
  }
  next();
}

/**
 * 验证文件大小
 */
export function validateFileSize(req: Request, res: Response, next: NextFunction): void {
  if (req.file && req.file.size > FILE_CONFIG.maxSize) {
    throw new FileUploadError(`文件大小超过限制 (最大 ${FILE_CONFIG.maxSize / 1024 / 1024}MB)`);
  }
  next();
}

/**
 * 验证文件类型
 */
export function validateFileType(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    return next();
  }

  const mimeType = req.file.mimetype;
  const originalName = req.file.originalname.toLowerCase();

  // 检查MIME类型
  const isValidMimeType = FILE_CONFIG.allowedMimeTypes.includes(mimeType);

  // 检查文件扩展名
  const isValidExtension = FILE_CONFIG.allowedExtensions.some(ext =>
    originalName.endsWith(ext)
  );

  if (!isValidMimeType && !isValidExtension) {
    throw new FileUploadError("不支持的文件类型");
  }

  next();
}

/**
 * 综合文件验证中间件
 */
export function validateFile(req: Request, res: Response, next: NextFunction): void {
  try {
    validateFileExists(req, res, () => {});
    validateFileSize(req, res, () => {});
    validateFileType(req, res, () => {});
    next();
  } catch (error) {
    next(error);
  }
}
