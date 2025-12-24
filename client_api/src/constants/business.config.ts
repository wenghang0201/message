// 消息限制
export const MESSAGE_LIMITS = {
  MAX_CONTENT_LENGTH: 10000,      // 最大内容长度
  MAX_BATCH_SIZE: 100,             // 最大批量操作大小
  DEFAULT_PAGE_SIZE: 30,           // 默认分页大小
} as const;

// 会话限制
export const CONVERSATION_LIMITS = {
  MAX_PINNED_CHATS: 5,             // 最多置顶聊天数
  MAX_GROUP_MEMBERS: 500,          // 最大群组成员数
} as const;

// 特殊日期（用于软删除边界）
export const SPECIAL_DATES = {
  FAR_FUTURE_DATE: '2099-12-31',                 // 遥远的未来日期
  MYSQL_TIMESTAMP_MAX: '2038-01-19 03:14:07',    // MySQL TIMESTAMP最大值
} as const;

// 限流配置
export const RATE_LIMITS = {
  // 认证限流
  AUTH_MAX_REQUESTS: 20,
  AUTH_WINDOW_MS: 15 * 60 * 1000,           // 15分钟

  // 密码修改限流
  PASSWORD_CHANGE_MAX_REQUESTS: 3,
  PASSWORD_CHANGE_WINDOW_MS: 60 * 60 * 1000, // 1小时

  // API通用限流
  API_MAX_REQUESTS: 300,
  API_WINDOW_MS: 1 * 60 * 1000,             // 1分钟

  // 读取操作限流
  READ_OPS_MAX_REQUESTS: 200,
  READ_OPS_WINDOW_MS: 1 * 60 * 1000,        // 1分钟
} as const;
