import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { FileKey } from "./FileKey.entity";

/**
 * 加密文件实体
 */
@Entity("encrypted_files")
export class EncryptedFile {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "uploader_id" })
  uploaderId: string;

  @Column({ type: "varchar", length: 255 })
  filename: string;

  @Column({ type: "bigint", name: "original_size", nullable: true })
  originalSize: number;

  @Column({ type: "varchar", length: 100, name: "mime_type", nullable: true })
  mimeType: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany(() => FileKey, (fileKey) => fileKey.file, { cascade: true })
  fileKeys: FileKey[];
}
