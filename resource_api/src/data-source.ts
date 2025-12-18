import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";
import { EncryptedFile } from "./models/EncryptedFile.entity";
import { FileKey } from "./models/FileKey.entity";

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
  entities: [EncryptedFile, FileKey],
  migrations: [path.join(__dirname, "./migrations/*.ts")],
  subscribers: [],
});
