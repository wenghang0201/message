import { Request, Response, NextFunction } from "express";
import appConfig from "../config/app.config";
import { FileUploadError } from "../utils/app-error.util";
import Log from "../utils/log.util";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

// 服务器端加密密钥（生产环境应该在.env中配置）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "my-32-character-secret-key-here!";
const ENCRYPTION_ALGORITHM = "aes-256-cbc";

/**
 * 加密上传控制器 - 服务器端自动加密
 */
export default class EncryptedUploadController {
  /**
   * 生成加密密钥
   */
  private generateKey(): Buffer {
    return crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  }

  /**
   * 获取当前年月文件夹名称 (格式: YYYY-MM)
   */
  private getMonthFolder(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * 确保文件夹存在
   */
  private ensureFolderExists(folderPath: string): void {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  }

  /**
   * 处理文件上传并自动加密
   */
  public handleUpload(request: Request, response: Response, next: NextFunction): void {
    try {
      // 验证文件是否存在
      if (!request.file) {
        throw new FileUploadError("文件上传失败");
      }

      // 验证文件名是否生成
      if (!request.body.fileName) {
        throw new FileUploadError("文件名生成失败");
      }

      // 确定月份文件夹
      const monthFolder = this.getMonthFolder();
      const monthFolderPath = path.join(appConfig.assetsUrl, monthFolder);

      // 确保月份文件夹存在
      this.ensureFolderExists(monthFolderPath);

      const originalFilePath = path.join(appConfig.assetsUrl, request.body.fileName);
      const encryptedFileName = request.body.fileName + ".enc";
      const encryptedFilePath = path.join(monthFolderPath, encryptedFileName);

      try {
        // 读取上传的文件
        const fileBuffer = fs.readFileSync(originalFilePath);

        // 生成加密密钥和IV
        const key = this.generateKey();
        const iv = crypto.randomBytes(16);

        // 创建加密器
        const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

        // 加密文件内容
        const encryptedData = Buffer.concat([
          cipher.update(fileBuffer),
          cipher.final()
        ]);

        // 将IV和加密数据一起保存
        const finalData = Buffer.concat([iv, encryptedData]);
        fs.writeFileSync(encryptedFilePath, finalData);

        // 删除原始未加密文件
        fs.unlinkSync(originalFilePath);


        // 资源地址 - 包含月份文件夹路径，不包含 .enc 扩展名
        const assetsUrl: string = `/resource/${monthFolder}/${request.body.fileName}`;

        // 返回数据
        response.json({
          result: 1,
          assetsUrl: assetsUrl,
          serverAddress: appConfig.resourceAddress
        });
      } catch (encryptError) {
        Log.error(`文件加密失败: ${encryptError}`);
        // 清理可能存在的文件
        if (fs.existsSync(originalFilePath)) {
          fs.unlinkSync(originalFilePath);
        }
        if (fs.existsSync(encryptedFilePath)) {
          fs.unlinkSync(encryptedFilePath);
        }
        throw new FileUploadError("文件加密失败");
      }
    } catch (error) {
      // 传递错误到错误处理中间件
      next(error);
    }
  }

  /**
   * 获取文件的MIME类型
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      // 图片
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      // 视频
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogv': 'video/ogg',
      '.mpeg': 'video/mpeg',
      // 音频
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.ogg': 'audio/ogg',
      '.oga': 'audio/ogg',
      '.wav': 'audio/wav',
      // 文档
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * 下载并解密文件（向后兼容 - 搜索所有月份文件夹）
   */
  public handleLegacyDownload(request: Request, response: Response, next: NextFunction): void {
    try {
      const { filename } = request.params;

      if (!filename) {
        throw new FileUploadError("文件名缺失");
      }

      // 首先尝试在根目录查找（旧的扁平结构）
      let encryptedFilePath = path.join(appConfig.assetsUrl, filename + ".enc");

      // 如果根目录不存在，搜索所有月份文件夹
      if (!fs.existsSync(encryptedFilePath)) {
        const resourceDir = appConfig.assetsUrl;
        if (fs.existsSync(resourceDir)) {
          const folders = fs.readdirSync(resourceDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

          // 搜索所有月份文件夹
          for (const folder of folders) {
            const testPath = path.join(resourceDir, folder, filename + ".enc");
            if (fs.existsSync(testPath)) {
              encryptedFilePath = testPath;
              break;
            }
          }
        }
      }

      if (!fs.existsSync(encryptedFilePath)) {
        response.status(404).json({
          result: 0,
          message: "文件不存在"
        });
        return;
      }

      try {
        // 读取加密文件
        const fileData = fs.readFileSync(encryptedFilePath);

        // 提取IV和加密数据
        const iv = fileData.slice(0, 16);
        const encryptedData = fileData.slice(16);

        // 生成解密密钥
        const key = this.generateKey();

        // 创建解密器
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);

        // 解密文件内容
        const decryptedData = Buffer.concat([
          decipher.update(encryptedData),
          decipher.final()
        ]);


        // 检测文件类型并设置正确的Content-Type
        const mimeType = this.getMimeType(filename);

        // 设置响应头
        response.setHeader("Content-Type", mimeType);
        response.setHeader("Content-Disposition", `inline; filename="${filename}"`);

        // 返回解密后的文件
        response.send(decryptedData);
      } catch (decryptError) {
        Log.error(`文件解密失败: ${decryptError}`);
        throw new FileUploadError("文件解密失败");
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 下载并解密文件
   */
  public handleDownload(request: Request, response: Response, next: NextFunction): void {
    try {
      const { folder, filename } = request.params;

      if (!folder || !filename) {
        throw new FileUploadError("文件路径缺失");
      }

      const encryptedFilePath = path.join(appConfig.assetsUrl, folder, filename + ".enc");

      if (!fs.existsSync(encryptedFilePath)) {
        response.status(404).json({
          result: 0,
          message: "文件不存在"
        });
        return;
      }

      try {
        // 读取加密文件
        const fileData = fs.readFileSync(encryptedFilePath);

        // 提取IV和加密数据
        const iv = fileData.slice(0, 16);
        const encryptedData = fileData.slice(16);

        // 生成解密密钥
        const key = this.generateKey();

        // 创建解密器
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);

        // 解密文件内容
        const decryptedData = Buffer.concat([
          decipher.update(encryptedData),
          decipher.final()
        ]);


        // 检测文件类型并设置正确的Content-Type
        const mimeType = this.getMimeType(filename);

        // 设置响应头
        response.setHeader("Content-Type", mimeType);
        response.setHeader("Content-Disposition", `inline; filename="${filename}"`);

        // 返回解密后的文件
        response.send(decryptedData);
      } catch (decryptError) {
        Log.error(`文件解密失败: ${decryptError}`);
        throw new FileUploadError("文件解密失败");
      }
    } catch (error) {
      next(error);
    }
  }
}
