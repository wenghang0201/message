import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";
import { User } from "./models/User.entity";
import { RefreshToken } from "./models/RefreshToken.entity";
import { UserProfile } from "./models/UserProfile.entity";
import { Friend } from "./models/Friend.entity";
import { Conversation } from "./models/Conversation.entity";
import { ConversationUser } from "./models/ConversationUser.entity";
import { Message } from "./models/Message.entity";
import { MessageStatus } from "./models/MessageStatus.entity";
import { MessageReaction } from "./models/MessageReaction.entity";
import { Notification } from "./models/Notification.entity";

// 加载环境变量
dotenv.config();

/**
 * TypeORM数据源配置（用于CLI迁移）
 * 此文件被TypeORM CLI命令使用
 */
export const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  username: process.env.DB_USERNAME || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "chat_client_db",
  synchronize: false,
  logging: process.env.NODE_ENV === "development",
  entities: [
    User,
    RefreshToken,
    UserProfile,
    Friend,
    Conversation,
    ConversationUser,
    Message,
    MessageStatus,
    MessageReaction,
    Notification,
  ],
  migrations: [path.join(__dirname, "./migrations/*.ts")],
  subscribers: [],
});
