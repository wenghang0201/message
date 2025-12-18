import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeletedAtToConversationUser1764232934347 implements MigrationInterface {
    name = 'AddDeletedAtToConversationUser1764232934347'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`conversation_users\` ADD \`deleted_at\` timestamp NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`conversation_users\` DROP COLUMN \`deleted_at\``);
    }

}
