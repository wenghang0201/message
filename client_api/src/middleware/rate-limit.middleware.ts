import rateLimit from "express-rate-limit";
import Log from "../utils/log.util";

/**
 * 认证端点的速率限制器
 * 防止登录/注册的暴力破解攻击
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 每个IP每15分钟最多5次请求
  message: {
    success: false,
    error: {
      message: "认证尝试次数过多，请15分钟后再试",
      statusCode: 429,
    },
  },
  standardHeaders: true, // 在RateLimit-*头中返回速率限制信息
  legacyHeaders: false, // 禁用X-RateLimit-*头
  handler: (req, res) => {
    Log.warn(`IP ${req.ip} 在 ${req.path} 超过速率限制`);
    res.status(429).json({
      success: false,
      error: {
        message: "认证尝试次数过多，请15分钟后再试",
        statusCode: 429,
      },
    });
  },
});

/**
 * 密码修改端点的速率限制器
 * 更严格的限制以防止密码修改攻击
 */
export const passwordChangeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3, // 每个IP每小时最多3次密码修改
  message: {
    success: false,
    error: {
      message: "密码修改尝试次数过多，请1小时后再试",
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    Log.warn(`IP ${req.ip} 密码修改超过速率限制`);
    res.status(429).json({
      success: false,
      error: {
        message: "密码修改尝试次数过多，请1小时后再试",
        statusCode: 429,
      },
    });
  },
});

/**
 * 通用API速率限制器
 * 防止API滥用
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP每15分钟最多100次请求
  message: {
    success: false,
    error: {
      message: "请求次数过多，请稍后再试",
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 跳过WebSocket升级请求的速率限制
    if (req.headers.upgrade === "websocket") {
      return true;
    }
    // 跳过高频读取操作（标记已读、获取消息等）
    const highFrequencyPaths = [
      /\/conversations\/[^/]+\/read$/,
      /\/messages$/,
    ];
    return highFrequencyPaths.some(pattern => pattern.test(req.path));
  },
});

/**
 * 读取操作速率限制器
 * 用于高频读取操作，限制更宽松
 */
export const readOperationsRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 60, // 每个IP每分钟最多60次请求
  message: {
    success: false,
    error: {
      message: "读取操作过于频繁，请稍后再试",
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
