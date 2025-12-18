import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHiddenUntilToConversationUser1764233475341 implements MigrationInterface {
    name = 'AddHiddenUntilToConversationUser1764233475341'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`conversation_users\` ADD \`hidden_until\` timestamp NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`conversation_users\` DROP COLUMN \`hidden_until\``);
    }

}
