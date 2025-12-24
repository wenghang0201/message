/**
 * Application-wide configuration constants
 * Centralizes all magic numbers for maintainability
 *
 * This file replaces hardcoded values throughout the codebase:
 * - Time windows (5 minutes for message deletion/recall)
 * - Conversation limits (5 max pinned chats)
 * - Display limits (99+ for unread count)
 * - Special dates (MySQL timestamp boundaries)
 */

// Message limits
export const MESSAGE_LIMITS = {
  MAX_CONTENT_LENGTH: 10000,
  MAX_BATCH_SIZE: 100,
  DEFAULT_PAGE_SIZE: 30,
} as const;

// Conversation limits
export const CONVERSATION_LIMITS = {
  MAX_PINNED_CHATS: 5,
  MAX_GROUP_MEMBERS: 500,
} as const;

// Time windows (in milliseconds)
export const TIME_WINDOWS = {
  MESSAGE_DELETE_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  MESSAGE_RECALL_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,    // 15 minutes
  ONLINE_STATUS_THRESHOLD_MS: 5 * 60 * 1000, // 5 minutes
} as const;

// Display limits
export const DISPLAY_LIMITS = {
  UNREAD_COUNT_MAX: 99,
  UNREAD_DISPLAY: '99+',
} as const;

// Special dates (for soft delete boundaries)
export const SPECIAL_DATES = {
  FAR_FUTURE_DATE: '2099-12-31',
  MYSQL_TIMESTAMP_MAX: '2038-01-19 03:14:07',
} as const;

// Rate limiting
export const RATE_LIMITS = {
  API_REQUESTS_PER_WINDOW: 100,
  AUTH_REQUESTS_PER_WINDOW: 5,
} as const;
