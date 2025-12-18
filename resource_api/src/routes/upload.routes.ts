import { Router } from "express";
import multer = require("multer");
import { MulterConfig } from "../config/multer.config";
import EncryptedUploadController from "../controllers/encrypted-upload.controller";
import { validateFile } from "../middleware/fileValidation.middleware";

/**
 * 上传路由 - 服务器端自动加密
 */
class UploadRoutes {
  public router: Router;
  private uploadController: EncryptedUploadController;

  constructor() {
    this.router = Router();
    this.uploadController = new EncryptedUploadController();
    this.initializeRoutes();
  }

  /**
   * 初始化路由
   */
  private initializeRoutes(): void {
    //配置Multer（带文件大小限制）
    const storage = MulterConfig.getStorage();
    const upload = multer({
      storage,
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
      }
    });

    //定义上传路由（自动加密）
    this.router.post(
      "/resource",
      upload.single("files"),
      validateFile,
      this.uploadController.handleUpload.bind(this.uploadController)
    );

    //定义下载路由（自动解密）- 支持文件夹路径
    this.router.get(
      "/resource/:folder/:filename",
      this.uploadController.handleDownload.bind(this.uploadController)
    );
  }
}

export default new UploadRoutes().router;
