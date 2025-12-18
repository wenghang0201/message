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

export enum DeliveryStatus {
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
}

/**
 * 消息状态实体（已读回执）
 */
@Entity("message_statuses")
@Index(["messageId", "userId"], { unique: true })
export class MessageStatus {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "message_id" })
  messageId: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({
    type: "enum",
    enum: DeliveryStatus,
    default: DeliveryStatus.SENT,
  })
  status: DeliveryStatus;

  @CreateDateColumn({ name: "timestamp" })
  timestamp: Date;

  @ManyToOne(() => Message, (message) => message.statuses, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "message_id" })
  message: Message;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;
}
