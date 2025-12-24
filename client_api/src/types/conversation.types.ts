export interface ConversationListItem {
  id: string;
  type: "single" | "group";
  name: string;
  avatar: string | null;
  otherUserId?: string;
  lastMessage?: {
    id: string;
    senderId: string;
    content: string;
    type: string;
    createdAt: Date;
  };
  unreadCount: number;
  isPinned?: boolean;
  pinnedAt?: Date | null;
  mutedUntil?: Date | null;
  disbandedAt?: Date | null;
  leftAt?: Date | null; // 用户离开或被移除的时间
  isOnline?: boolean;
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
