import { FriendStatus } from "../models/Friend.entity";

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
