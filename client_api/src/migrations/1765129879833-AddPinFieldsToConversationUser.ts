import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPinFieldsToConversationUser1765129879833 implements MigrationInterface {
    name = 'AddPinFieldsToConversationUser1765129879833'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`conversation_users\` ADD \`is_pinned\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`conversation_users\` ADD \`pinned_at\` timestamp NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`conversation_users\` DROP COLUMN \`pinned_at\``);
        await queryRunner.query(`ALTER TABLE \`conversation_users\` DROP COLUMN \`is_pinned\``);
    }

}
