import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { EncryptedFile } from "./EncryptedFile.entity";

/**
 * 文件密钥实体
 */
@Entity("file_keys")
export class FileKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "file_id" })
  fileId: string;

  @Column({ type: "uuid", name: "recipient_id" })
  recipientId: string;

  @Column({ type: "text", name: "encrypted_key" })
  encryptedKey: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => EncryptedFile, (file) => file.fileKeys, { onDelete: "CASCADE" })
  @JoinColumn({ name: "file_id" })
  file: EncryptedFile;
}
