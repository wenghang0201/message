import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGroupPermissionsToConversation1765134022169 implements MigrationInterface {
    name = 'AddGroupPermissionsToConversation1765134022169'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`conversations\` ADD \`message_send_permission\` enum ('all_members', 'admin_only', 'owner_only') NOT NULL DEFAULT 'all_members'`);
        await queryRunner.query(`ALTER TABLE \`conversations\` ADD \`member_add_permission\` enum ('all_members', 'admin_only', 'owner_only') NOT NULL DEFAULT 'admin_only'`);
        await queryRunner.query(`ALTER TABLE \`conversations\` ADD \`require_approval\` tinyint NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`conversations\` DROP COLUMN \`require_approval\``);
        await queryRunner.query(`ALTER TABLE \`conversations\` DROP COLUMN \`member_add_permission\``);
        await queryRunner.query(`ALTER TABLE \`conversations\` DROP COLUMN \`message_send_permission\``);
    }

}
