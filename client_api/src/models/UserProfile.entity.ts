import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.entity";

/**
 * 用户资料实体
 */
@Entity("user_profiles")
export class UserProfile {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "user_id", unique: true })
  userId: string;

  @Column({ type: "varchar", length: 255, nullable: true, name: "avatar_url" })
  avatarUrl: string | null;

  @Column({ type: "text", nullable: true })
  bio: string | null;

  @Column({ type: "varchar", length: 20, nullable: true, name: "phone_number" })
  phoneNumber: string | null;

  @Column({ type: "varchar", length: 100, nullable: true, name: "status_message" })
  statusMessage: string | null;

  @Column({ type: "boolean", default: false, name: "is_online" })
  isOnline: boolean;

  @Column({ type: "timestamp", nullable: true, name: "last_seen_at" })
  lastSeenAt: Date | null;

  @Column({ type: "json", nullable: true, name: "privacy_settings" })
  privacySettings: {
    showLastSeen?: "everyone" | "friends" | "nobody";
  } | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn({ name: "user_id" })
  user: User;
}
