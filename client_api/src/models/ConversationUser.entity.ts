import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Conversation } from "./Conversation.entity";
import { User } from "./User.entity";

export enum MemberRole {
  MEMBER = "member",
  ADMIN = "admin",
  OWNER = "owner",
}

/**
 * 会话用户实体
 */
@Entity("conversation_users")
@Index(["conversationId", "userId"], { unique: true })
export class ConversationUser {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "conversation_id" })
  conversationId: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({
    type: "enum",
    enum: MemberRole,
    default: MemberRole.MEMBER,
  })
  role: MemberRole;

  @CreateDateColumn({ name: "joined_at" })
  joinedAt: Date;

  @Column({ type: "uuid", nullable: true, name: "last_read_message_id" })
  lastReadMessageId: string | null;

  @Column({ type: "timestamp", nullable: true, name: "muted_until" })
  mutedUntil: Date | null;

  @Column({ type: "timestamp", nullable: true, name: "deleted_at" })
  deletedAt: Date | null;

  @Column({ type: "timestamp", nullable: true, name: "hidden_until" })
  hiddenUntil: Date | null;

  @Column({ type: "boolean", default: false, name: "is_pinned" })
  isPinned: boolean;

  @Column({ type: "timestamp", nullable: true, name: "pinned_at" })
  pinnedAt: Date | null;

  @ManyToOne(() => Conversation, (conversation) => conversation.members, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversation_id" })
  conversation: Conversation;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;
}
