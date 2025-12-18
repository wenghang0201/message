import multer = require("multer");
import { Request } from "express";
import appConfig from "./app.config";

/**
 * Multer配置
 */
export class MulterConfig {
  /**
   * 文件名称处理
   */
  public static filename(request: Request, file: Express.Multer.File, callback: Function): void {
    //数据赋值
    const fileName: string = Date.now() + "-" + file.originalname;
    request.body.fileName = fileName;

    //回调函数
    callback(null, fileName);
  }

  /**
   * 目标地址
   */
  public static destination(request: Request, file: Express.Multer.File, callback: Function): void {
    //回调函数
    callback(null, appConfig.assetsUrl);
  }

  /**
   * 获取Multer存储配置
   */
  public static getStorage(): multer.StorageEngine {
    return multer.diskStorage({
      destination: MulterConfig.destination,
      filename: MulterConfig.filename
    });
  }
}
