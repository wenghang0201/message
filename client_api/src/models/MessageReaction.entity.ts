import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Message } from "./Message.entity";
import { User } from "./User.entity";

/**
 * 消息反应实体（emoji表情回复）
 */
@Entity("message_reactions")
@Index(["messageId", "userId", "emoji"], { unique: true })
export class MessageReaction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "message_id" })
  messageId: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({ type: "varchar", length: 10 })
  emoji: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => Message, (message) => message.reactions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "message_id" })
  message: Message;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;
}
