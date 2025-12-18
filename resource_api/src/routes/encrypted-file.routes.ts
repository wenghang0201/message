import { Router } from "express";
import encryptedFileController from "../controllers/encrypted-file.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validation.middleware";
import { uploadEncryptedFileSchema } from "../schemas/file.schema";

/**
 * 加密文件路由
 */
class EncryptedFileRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // 所有路由都需要认证
    // 上传加密文件
    this.router.post(
      "/encrypted-resource",
      authenticateToken,
      validateBody(uploadEncryptedFileSchema),
      encryptedFileController.uploadEncryptedFile.bind(encryptedFileController)
    );

    // 下载加密文件
    this.router.get(
      "/encrypted-resource/:fileId",
      authenticateToken,
      encryptedFileController.downloadEncryptedFile.bind(encryptedFileController)
    );

    // 获取用户的文件列表
    this.router.get(
      "/encrypted-resource/user/files",
      authenticateToken,
      encryptedFileController.getUserFiles.bind(encryptedFileController)
    );
  }
}

export default new EncryptedFileRoutes().router;
