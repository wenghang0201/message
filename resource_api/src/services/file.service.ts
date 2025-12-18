import { Repository } from "typeorm";
import { AppDataSource } from "../config/database";
import { EncryptedFile } from "../models/EncryptedFile.entity";
import { FileKey } from "../models/FileKey.entity";
import appConfig from "../config/app.config";
import Log from "../utils/log.util";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

/**
 * 文件服务
 */
export class FileService {
  private encryptedFileRepository: Repository<EncryptedFile>;
  private fileKeyRepository: Repository<FileKey>;

  constructor() {
    this.encryptedFileRepository = AppDataSource.getRepository(EncryptedFile);
    this.fileKeyRepository = AppDataSource.getRepository(FileKey);
  }

  /**
   * 保存加密文件
   */
  public async saveEncryptedFile(
    uploaderId: string,
    encryptedFileBase64: string,
    encryptedKeys: Array<{ recipientId: string; encryptedKey: string }>,
    metadata?: { originalSize?: number; mimeType?: string }
  ): Promise<EncryptedFile> {
    // 生成唯一文件名
    const filename = `${Date.now()}-${crypto.randomUUID()}.enc`;
    const filePath = path.join(appConfig.assetsUrl, filename);

    // 解码Base64并保存加密文件到磁盘
    const encryptedBuffer = Buffer.from(encryptedFileBase64, "base64");
    fs.writeFileSync(filePath, encryptedBuffer);

    // 创建数据库记录
    const encryptedFile = this.encryptedFileRepository.create({
      uploaderId,
      filename,
      originalSize: metadata?.originalSize,
      mimeType: metadata?.mimeType,
    });

    await this.encryptedFileRepository.save(encryptedFile);

    // 保存每个收件人的加密密钥
    const fileKeys = encryptedKeys.map((ek) =>
      this.fileKeyRepository.create({
        fileId: encryptedFile.id,
        recipientId: ek.recipientId,
        encryptedKey: ek.encryptedKey,
      })
    );

    await this.fileKeyRepository.save(fileKeys);

    return encryptedFile;
  }

  /**
   * 获取加密文件和用户的加密密钥
   */
  public async getEncryptedFile(
    fileId: string,
    userId: string
  ): Promise<{ file: EncryptedFile; encryptedKey: string; encryptedFileData: string } | null> {
    // 查找文件
    const file = await this.encryptedFileRepository.findOne({
      where: { id: fileId },
    });

    if (!file) {
      return null;
    }

    // 查找用户的加密密钥
    const fileKey = await this.fileKeyRepository.findOne({
      where: {
        fileId: fileId,
        recipientId: userId,
      },
    });

    if (!fileKey) {
      // 用户没有访问权限
      return null;
    }

    // 读取加密文件
    const filePath = path.join(appConfig.assetsUrl, file.filename);

    if (!fs.existsSync(filePath)) {
      Log.error(`加密文件在磁盘上未找到: ${filePath}`);
      return null;
    }

    const encryptedBuffer = fs.readFileSync(filePath);
    const encryptedFileData = encryptedBuffer.toString("base64");

    return {
      file,
      encryptedKey: fileKey.encryptedKey,
      encryptedFileData,
    };
  }

  /**
   * 获取用户可访问的所有文件
   */
  public async getUserFiles(userId: string): Promise<EncryptedFile[]> {
    const fileKeys = await this.fileKeyRepository.find({
      where: { recipientId: userId },
      relations: ["file"],
    });

    const files = fileKeys.map((fk) => fk.file);

    return files;
  }
}

export default new FileService();
