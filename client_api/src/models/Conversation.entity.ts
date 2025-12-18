import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "./User.entity";
import { ConversationUser } from "./ConversationUser.entity";
import { Message } from "./Message.entity";

export enum ConversationType {
  SINGLE = "single",
  GROUP = "group",
}

export enum MessageSendPermission {
  ALL_MEMBERS = "all_members",
  ADMIN_ONLY = "admin_only",
  OWNER_ONLY = "owner_only",
}

export enum MemberAddPermission {
  ALL_MEMBERS = "all_members",
  ADMIN_ONLY = "admin_only",
  OWNER_ONLY = "owner_only",
}

/**
 * 会话实体（单聊或群聊）
 */
@Entity("conversations")
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: ConversationType,
    default: ConversationType.SINGLE,
  })
  type: ConversationType;

  @Column({ type: "varchar", length: 100, nullable: true })
  name: string | null;

  @Column({ type: "varchar", length: 255, nullable: true, name: "avatar_url" })
  avatarUrl: string | null;

  @Column({ type: "uuid", name: "created_by_id" })
  createdById: string;

  @Column({
    type: "enum",
    enum: MessageSendPermission,
    default: MessageSendPermission.ALL_MEMBERS,
    name: "message_send_permission",
  })
  messageSendPermission: MessageSendPermission;

  @Column({
    type: "enum",
    enum: MemberAddPermission,
    default: MemberAddPermission.ADMIN_ONLY,
    name: "member_add_permission",
  })
  memberAddPermission: MemberAddPermission;

  @Column({
    type: "boolean",
    default: false,
    name: "require_approval",
  })
  requireApproval: boolean;

  @Column({ type: "timestamp", nullable: true, name: "disbanded_at" })
  disbandedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by_id" })
  createdBy: User;

  @OneToMany(() => ConversationUser, (member) => member.conversation, {
    cascade: true,
  })
  members: ConversationUser[];

  @OneToMany(() => Message, (message) => message.conversation, {
    cascade: true,
  })
  messages: Message[];
}
