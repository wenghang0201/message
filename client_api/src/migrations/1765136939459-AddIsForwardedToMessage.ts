import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsForwardedToMessage1765136939459 implements MigrationInterface {
    name = 'AddIsForwardedToMessage1765136939459'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`messages\` ADD \`is_forwarded\` tinyint NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`is_forwarded\``);
    }

}
