import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDisbandedAtToConversations1765173515523 implements MigrationInterface {
    name = 'AddDisbandedAtToConversations1765173515523'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`conversations\` ADD \`disbanded_at\` timestamp NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`conversations\` DROP COLUMN \`disbanded_at\``);
    }

}
