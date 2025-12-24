/**
 * 应用程序全局配置常量
 * 集中管理所有魔法数字以提高可维护性
 *
 * 此文件替换代码库中的硬编码值：
 * - 时间窗口（消息删除/撤回的5分钟限制）
 * - 会话限制（最多5个置顶聊天）
 * - 显示限制（未读数99+）
 * - 特殊日期（MySQL时间戳边界）
 */

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

// 时间窗口（毫秒）
export const TIME_WINDOWS = {
  MESSAGE_DELETE_WINDOW_MS: 5 * 60 * 1000,      // 5分钟 - 消息删除窗口
  MESSAGE_RECALL_WINDOW_MS: 5 * 60 * 1000,      // 5分钟 - 消息撤回窗口
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,         // 15分钟 - 限流窗口
  ONLINE_STATUS_THRESHOLD_MS: 5 * 60 * 1000,    // 5分钟 - 在线状态阈值
} as const;

// 显示限制
export const DISPLAY_LIMITS = {
  UNREAD_COUNT_MAX: 99,            // 未读数最大显示值
  UNREAD_DISPLAY: '99+',           // 未读数显示文本
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
