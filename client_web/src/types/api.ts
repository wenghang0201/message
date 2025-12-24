import { MessageType } from './message';

/**
 * API相关的类型定义
 */

// 消息 API 类型
export interface MessageStatusInfo {
  userId: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: Date;
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  replyToMessageId: string | null;
  editedAt: Date | null;
  isForwarded: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  statuses?: MessageStatusInfo[];
}

export interface SendMessageDto {
  conversationId: string;
  type: string;
  content: string;
  replyToMessageId?: string;
  isForwarded?: boolean;
}

export interface UpdateMessageDto {
  content: string;
}

export interface GetMessagesResponse {
  messages: ApiMessage[];
  total: number;
  hasMore: boolean;
}

// 会话 API 类型
export interface ConversationListItem {
  id: string;
  type: 'single' | 'group';
  name: string;
  avatar: string | null;
  otherUserId?: string;
  lastMessage?: {
    id: string;
    senderId: string;
    content: string;
    type: string;
    createdAt: string;
  };
  unreadCount: number;
  isPinned?: boolean;
  pinnedAt?: string | null;
  mutedUntil?: string | null;
  disbandedAt?: string | null;
  leftAt?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSingleConversationDto {
  otherUserId: string;
}

export interface MarkAsReadDto {
  messageId: string;
}

export interface CreateGroupConversationDto {
  name: string;
  memberIds: string[];
  avatarUrl?: string | null;
}

export interface GroupMember {
  userId: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
}

export interface AddGroupMembersDto {
  memberIds: string[];
}

export interface UpdateMemberRoleDto {
  role: 'admin' | 'member';
}

// 认证 API 类型
export interface RegisterDto {
  username: string;
  email: string;
  password: string;
}

export interface LoginDto {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// 好友 API 类型
export enum FriendStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  BLOCKED = 'blocked',
}

export interface FriendListItem {
  id: string;
  userId: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  friendshipId: string;
  friendshipStatus: FriendStatus;
  createdAt: Date;
}

export interface FriendRequestItem {
  id: string;
  requesterId: string;
  requesterUsername: string;
  requesterEmail: string;
  requesterAvatarUrl: string | null;
  requesterBio: string | null;
  createdAt: Date;
}

export interface SearchUserItem {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  friendshipStatus: FriendStatus | null;
}

// 用户资料 API 类型
export interface UserProfile {
  id: string;
  userId: string;
  avatarUrl: string | null;
  bio: string | null;
  phoneNumber: string | null;
  statusMessage: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  privacySettings: {
    showLastSeen?: 'everyone' | 'nobody';
  } | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface UpdateProfileDto {
  avatarUrl?: string;
  bio?: string;
  phoneNumber?: string;
  statusMessage?: string;
}

export interface UpdatePrivacyDto {
  showLastSeen?: 'everyone' | 'nobody';
}

export interface UpdateOnlineStatusDto {
  isOnline: boolean;
}

// 上传 API 类型
export interface UploadResponse {
  result: number;
  assetsUrl: string;
  serverAddress: string;
}
