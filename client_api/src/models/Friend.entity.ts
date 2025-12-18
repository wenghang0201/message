import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User.entity";

export enum FriendStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  BLOCKED = "blocked",
}

/**
 * 好友关系实体
 */
@Entity("friends")
@Index(["requesterId", "recipientId"], { unique: true })
export class Friend {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "requester_id" })
  requesterId: string;

  @Column({ type: "uuid", name: "recipient_id" })
  recipientId: string;

  @Column({
    type: "enum",
    enum: FriendStatus,
    default: FriendStatus.PENDING,
  })
  status: FriendStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "requester_id" })
  requester: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: "recipient_id" })
  recipient: User;
}
