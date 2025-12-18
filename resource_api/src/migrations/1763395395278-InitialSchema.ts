import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1763395395278 implements MigrationInterface {
    name = 'InitialSchema1763395395278'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`file_keys\` (\`id\` varchar(36) NOT NULL, \`file_id\` varchar(255) NOT NULL, \`recipient_id\` varchar(255) NOT NULL, \`encrypted_key\` text NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`encrypted_files\` (\`id\` varchar(36) NOT NULL, \`uploader_id\` varchar(255) NOT NULL, \`filename\` varchar(255) NOT NULL, \`original_size\` bigint NULL, \`mime_type\` varchar(100) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`file_keys\` ADD CONSTRAINT \`FK_482cab28fecfee642a5ea8433f2\` FOREIGN KEY (\`file_id\`) REFERENCES \`encrypted_files\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`file_keys\` DROP FOREIGN KEY \`FK_482cab28fecfee642a5ea8433f2\``);
        await queryRunner.query(`DROP TABLE \`encrypted_files\``);
        await queryRunner.query(`DROP TABLE \`file_keys\``);
    }

}
