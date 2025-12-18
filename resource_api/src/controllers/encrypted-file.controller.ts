import { Request, Response, NextFunction } from "express";
import fileService from "../services/file.service";
import { UploadEncryptedFileDto } from "../schemas/file.schema";
import { ResponseUtil } from "../utils/response.util";
import Log from "../utils/log.util";

/**
 * 加密文件控制器
 */
export class EncryptedFileController {
  /**
   * 上传加密文件
   * POST /encrypted-resource
   */
  public async uploadEncryptedFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!; // 由auth middleware设置
      const { encryptedFile, encryptedKeys, metadata } = req.body as UploadEncryptedFileDto;

      // 保存加密文件
      // Yup验证后，encryptedKeys保证具有必需的字段
      const file = await fileService.saveEncryptedFile(
        userId,
        encryptedFile,
        encryptedKeys as Array<{ recipientId: string; encryptedKey: string }>,
        metadata
      );

      ResponseUtil.created(
        res,
        {
          fileId: file.id,
          filename: file.filename,
          uploaderId: file.uploaderId,
          recipientCount: encryptedKeys.length,
          createdAt: file.createdAt,
        },
        "Encrypted file uploaded successfully"
      );
    } catch (error) {
      Log.error(`文件上传失败: ${error}`);
      next(error);
    }
  }

  /**
   * 下载加密文件
   * GET /encrypted-resource/:fileId
   */
  public async downloadEncryptedFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!; // 由auth middleware设置
      const { fileId } = req.params;

      const result = await fileService.getEncryptedFile(fileId, userId);

      if (!result) {
        ResponseUtil.notFound(res, "文件未找到或访问被拒绝");
        return;
      }

      ResponseUtil.success(res, {
        fileId: result.file.id,
        encryptedFile: result.encryptedFileData,
        encryptedKey: result.encryptedKey,
        metadata: {
          uploaderId: result.file.uploaderId,
          originalSize: result.file.originalSize,
          mimeType: result.file.mimeType,
          createdAt: result.file.createdAt,
        },
      });
    } catch (error) {
      Log.error(`文件下载失败: ${error}`);
      next(error);
    }
  }

  /**
   * 获取用户的文件列表
   * GET /encrypted-resource/user/files
   */
  public async getUserFiles(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.userId!; // 由auth middleware设置

      const files = await fileService.getUserFiles(userId);

      ResponseUtil.success(res, {
        files: files.map((file) => ({
          fileId: file.id,
          uploaderId: file.uploaderId,
          originalSize: file.originalSize,
          mimeType: file.mimeType,
          createdAt: file.createdAt,
        })),
        count: files.length,
      });
    } catch (error) {
      Log.error(`获取文件列表失败: ${error}`);
      next(error);
    }
  }
}

export default new EncryptedFileController();
