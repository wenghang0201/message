/**
 * UI 限制常量
 * 集中管理前端 UI 相关的限制和阈值
 */

/**
 * UI 显示限制
 */
export const UI_LIMITS = {
  /** 未读消息数最大显示值（超过显示 99+） */
  UNREAD_COUNT_MAX: 99,

  /** 语音录制最大时长（秒） */
  MAX_VOICE_RECORDING_DURATION: 60,

  /** 语音录制最小时长（秒） */
  MIN_VOICE_RECORDING_DURATION: 1,
} as const;

/**
 * 时间常量（毫秒）
 */
export const TIME_CONSTANTS = {
  /** 消息删除时间窗口 - 5分钟（与后端保持一致） */
  MESSAGE_DELETE_WINDOW: 5 * 60 * 1000,

  /** 长按触发时长 */
  LONG_PRESS_DURATION: 500,

  /** 语音按钮按下延迟 */
  VOICE_PRESS_DELAY: 200,

  /** 防抖延迟 */
  DEBOUNCE_DELAY: 300,
} as const;

/**
 * 日期阈值（毫秒）
 * 用于格式化相对时间显示
 */
export const DATE_THRESHOLDS = {
  /** 一分钟 */
  MINUTE_MS: 60 * 1000,

  /** 一小时 */
  HOUR_MS: 60 * 60 * 1000,

  /** 一天 */
  DAY_MS: 24 * 60 * 60 * 1000,

  /** 一周 */
  WEEK_MS: 7 * 24 * 60 * 60 * 1000,
} as const;
