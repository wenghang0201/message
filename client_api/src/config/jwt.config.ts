import * as dotenv from "dotenv";
import Log from "../utils/log.util";

dotenv.config();

/**
 * JWT配置
 */
export const jwtConfig = {
  secret: process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production",
  accessTokenExpiration: process.env.JWT_ACCESS_EXPIRATION || "30d",
  refreshTokenExpiration: process.env.JWT_REFRESH_EXPIRATION || "365d",
};

if (jwtConfig.secret.length < 32) {
  Log.warn("警告: JWT_SECRET长度应至少为32个字符以确保安全!");
}
