import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User.entity";

export enum NotificationType {
  FRIEND_REQUEST = "friend_request",
  FRIEND_ACCEPTED = "friend_accepted",
  NEW_MESSAGE = "new_message",
  GROUP_INVITE = "group_invite",
  MENTION = "mention",
  REACTION = "reaction",
}

/**
 * 通知实体
 */
@Entity("notifications")
@Index(["userId", "createdAt"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({
    type: "enum",
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "json", nullable: true })
  data: Record<string, any> | null;

  @Column({ type: "boolean", default: false, name: "is_read" })
  isRead: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;
}
