import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from "typeorm";
import { Conversation } from "./Conversation.entity";
import { User } from "./User.entity";
import { MessageStatus } from "./MessageStatus.entity";
import { MessageReaction } from "./MessageReaction.entity";

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video",
  VOICE = "voice",
  FILE = "file",
  SYSTEM = "system",
}

/**
 * 消息实体
 */
@Entity("messages")
@Index(["conversationId", "createdAt"])
export class Message {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "conversation_id" })
  conversationId: string;

  @Column({ type: "uuid", name: "sender_id" })
  senderId: string;

  @Column({
    type: "enum",
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({ type: "text" })
  content: string;

  @Column({ type: "uuid", nullable: true, name: "reply_to_message_id" })
  replyToMessageId: string | null;

  @Column({ type: "timestamp", nullable: true, name: "edited_at" })
  editedAt: Date | null;

  @Column({ type: "boolean", default: false, name: "is_forwarded" })
  isForwarded: boolean;

  @Column({ type: "timestamp", nullable: true, name: "deleted_at" })
  deletedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversation_id" })
  conversation: Conversation;

  @ManyToOne(() => User)
  @JoinColumn({ name: "sender_id" })
  sender: User;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: "reply_to_message_id" })
  replyToMessage: Message | null;

  @OneToMany(() => MessageStatus, (status) => status.message, {
    cascade: true,
  })
  statuses: MessageStatus[];

  @OneToMany(() => MessageReaction, (reaction) => reaction.message, {
    cascade: true,
  })
  reactions: MessageReaction[];
}
