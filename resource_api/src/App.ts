//本地引入
import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "path";
import express = require("express");
import { Express } from "express";
import cors = require("cors");
import Log from "./utils/log.util";
import appConfig from "./config/app.config";
import { initializeDatabase } from "./config/database";
import uploadRoutes from "./routes/upload.routes";
import encryptedFileRoutes from "./routes/encrypted-file.routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

// 加载环境变量
dotenv.config();

/**
 * 数据服务
 */
class App {
  private _express: Express;

  //初始化
  constructor() {
    //初始化日志
    Log.init();

    //初始化 assetsUrl 为绝对路径
    if (!path.isAbsolute(appConfig.assetsUrl)) {
      appConfig.assetsUrl = path.join(process.cwd(), appConfig.assetsUrl);
    }

    //开启服务
    this.startServer();
  }

  //开启服务
  private async startServer(): Promise<void> {
    try {
      //显示标题
      process.title = "资源服务器";

      //初始化数据库连接
      await initializeDatabase();
      Log.info("数据库连接成功");

      //初始化Express
      this._express = express();

      //CORS中间件 - 允许前端访问
      this._express.use(cors({
        origin: function(origin, callback) {
          // 允许所有 trycloudflare.com 域名和 localhost
          const allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000'
          ];

          // 如果 origin 是 undefined (比如 Postman) 或在允许列表中，或者是 trycloudflare.com
          if (!origin || allowedOrigins.includes(origin) || origin.includes('trycloudflare.com')) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      }));

      //中间件
      this._express.use(express.json({ limit: "50mb" })); // 支持大文件的JSON
      this._express.use(express.urlencoded({ extended: true, limit: "50mb" }));

      //使用路由
      this._express.use(uploadRoutes); // 自动加密的文件上传
      this._express.use(encryptedFileRoutes); // E2E加密文件路由

      //404错误处理（必须在所有路由之后）
      this._express.use(notFoundHandler);

      //全局错误处理（必须在最后）
      this._express.use(errorHandler);

      //监听端口
      this._express.listen(appConfig.serverPort, this.onListenSuccess.bind(this));
    } catch (error) {
      Log.error(`启动服务器失败: ${error}`);
      process.exit(1);
    }
  }

  //监听成功
  private onListenSuccess(): void {
    //打印日志
    Log.info(`✅ 资源API服务器启动成功 - 端口: ${appConfig.serverPort}`);
  }
}

//初始化
new App();
