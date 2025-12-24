import "reflect-metadata";
import * as dotenv from "dotenv";
import express, { Express } from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import Tool from "./utils/tool.util";
import Log from "./utils/log.util";
import appConfig from "./config/app.config";
import { initializeDatabase } from "./config/database";
import { setupContainer } from "./container/container";
import authRoutes from "./routes/auth.routes";
import userProfileRoutes from "./routes/user-profile.routes";
import conversationRoutes from "./routes/conversation.routes";
import messageRoutes from "./routes/message.routes";
import friendRoutes from "./routes/friend.routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { apiRateLimiter } from "./middleware/rate-limit.middleware";
import websocketService from "./services/websocket.service";

// 加载环境变量
dotenv.config();

/**
 * 客户端API服务
 */
class App {
  private _express: Express;

  constructor() {
    // 初始化日志
    Log.init();

    // 加载配置
    Tool.readJson(
      "config/client.json",
      this.onReadError.bind(this, "config/client.json"),
      this.onGetSuccess.bind(this)
    );
  }

  /**
   * 初始化数据库并启动服务器
   */
  private async startServer(): Promise<void> {
    try {
      // 设置进程标题
      process.title = "客户端API服务器";

      // 初始化数据库连接
      await initializeDatabase();
      Log.info("数据库连接成功");

      // 初始化依赖注入容器
      setupContainer();
      Log.info("依赖注入容器初始化成功");

      // 初始化Express
      this._express = express();

      // 安全中间件 - Helmet 添加安全头
      this._express.use(helmet({
        contentSecurityPolicy: false, // 禁用CSP以兼容WebSocket
        crossOriginEmbedderPolicy: false, // 允许跨域资源
      }));

      // 通用API速率限制
      this._express.use("/api", apiRateLimiter);

      // 中间件
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
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization']
      })); // 启用CORS
      this._express.use(express.json()); // 解析JSON请求体
      this._express.use(express.urlencoded({ extended: true })); // 解析URL编码的请求体

      // API路由
      this._express.use("/api", authRoutes);
      this._express.use("/api", userProfileRoutes);
      this._express.use("/api", conversationRoutes);
      this._express.use("/api", messageRoutes);
      this._express.use("/api", friendRoutes);

      // 404错误处理（必须在所有路由之后）
      this._express.use(notFoundHandler);

      // 全局错误处理（必须在最后）
      this._express.use(errorHandler);

      // 创建HTTP服务器并初始化WebSocket
      const port = parseInt(process.env.PORT || String(appConfig.serverPort));
      const httpServer = createServer(this._express);

      // 初始化WebSocket服务
      websocketService.initialize(httpServer);

      // 监听端口
      httpServer.listen(port, this.onListenSuccess.bind(this, port));
    } catch (error) {
      Log.error(`启动服务器失败: ${error}`);
      process.exit(1);
    }
  }

  /**
   * 监听成功回调
   */
  private onListenSuccess(port: number): void {
    Log.info(`✅ 客户端API服务器启动成功 - 端口: ${port}`);
  }

  /**
   * 获取配置成功回调
   */
  private onGetSuccess(data: any): void {
    // 初始化配置值
    appConfig.serverPort = data.serverPort || 9003;
    appConfig.resourceApiUrl = data.resourceApiUrl || "http://127.0.0.1:9001";

    // 启动服务器
    this.startServer();
  }

  /**
   * 读取配置错误回调
   */
  private onReadError(url: string, err: Error): void {
    Log.error(`读取${url}配置失败: ${JSON.stringify(err)}`);
    Log.info("使用默认配置启动服务器");

    // 使用默认配置启动
    this.startServer();
  }
}

// 初始化应用
new App();
