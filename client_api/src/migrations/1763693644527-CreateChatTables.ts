import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateChatTables1763693644527 implements MigrationInterface {
    name = 'CreateChatTables1763693644527'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`user_profiles\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`avatar_url\` varchar(255) NULL, \`bio\` text NULL, \`phone_number\` varchar(20) NULL, \`status_message\` varchar(100) NULL, \`is_online\` tinyint NOT NULL DEFAULT 0, \`last_seen_at\` timestamp NULL, \`privacy_settings\` json NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_6ca9503d77ae39b4b5a6cc3ba8\` (\`user_id\`), UNIQUE INDEX \`REL_6ca9503d77ae39b4b5a6cc3ba8\` (\`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`friends\` (\`id\` varchar(36) NOT NULL, \`requester_id\` varchar(255) NOT NULL, \`recipient_id\` varchar(255) NOT NULL, \`status\` enum ('pending', 'accepted', 'rejected', 'blocked') NOT NULL DEFAULT 'pending', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_a9c6d3a04febb4c0913239752e\` (\`requester_id\`, \`recipient_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`conversation_users\` (\`id\` varchar(36) NOT NULL, \`conversation_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`role\` enum ('member', 'admin', 'owner') NOT NULL DEFAULT 'member', \`joined_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`last_read_message_id\` varchar(255) NULL, \`muted_until\` timestamp NULL, UNIQUE INDEX \`IDX_518dfc5846cc3bce09135801a9\` (\`conversation_id\`, \`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`message_statuses\` (\`id\` varchar(36) NOT NULL, \`message_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`status\` enum ('sent', 'delivered', 'read') NOT NULL DEFAULT 'sent', \`timestamp\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_aa29a73af33a25a7fba23c242c\` (\`message_id\`, \`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`message_reactions\` (\`id\` varchar(36) NOT NULL, \`message_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`emoji\` varchar(10) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_f5a1f46b4f33ce416f9c192ab2\` (\`message_id\`, \`user_id\`, \`emoji\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`messages\` (\`id\` varchar(36) NOT NULL, \`conversation_id\` varchar(255) NOT NULL, \`sender_id\` varchar(255) NOT NULL, \`type\` enum ('text', 'image', 'video', 'voice', 'file', 'system') NOT NULL DEFAULT 'text', \`content\` text NOT NULL, \`reply_to_message_id\` varchar(255) NULL, \`edited_at\` timestamp NULL, \`deleted_at\` timestamp NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_8584a1974e1ca95f4861d975ff\` (\`conversation_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`conversations\` (\`id\` varchar(36) NOT NULL, \`type\` enum ('single', 'group') NOT NULL DEFAULT 'single', \`name\` varchar(100) NULL, \`avatar_url\` varchar(255) NULL, \`created_by_id\` varchar(255) NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`notifications\` (\`id\` varchar(36) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`type\` enum ('friend_request', 'friend_accepted', 'new_message', 'group_invite', 'mention', 'reaction') NOT NULL, \`title\` varchar(255) NOT NULL, \`message\` text NOT NULL, \`data\` json NULL, \`is_read\` tinyint NOT NULL DEFAULT 0, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_310667f935698fcd8cb319113a\` (\`user_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`user_profiles\` ADD CONSTRAINT \`FK_6ca9503d77ae39b4b5a6cc3ba88\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`friends\` ADD CONSTRAINT \`FK_890c2646c24c98422c19969b199\` FOREIGN KEY (\`requester_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`friends\` ADD CONSTRAINT \`FK_ad43e3c137c8548e461e1035c1c\` FOREIGN KEY (\`recipient_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`conversation_users\` ADD CONSTRAINT \`FK_f97c42b0b6d0b7cd6aa50a481db\` FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversations\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`conversation_users\` ADD CONSTRAINT \`FK_8af317937c014db4135b1326958\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`message_statuses\` ADD CONSTRAINT \`FK_229b8548ced91512c3d1f08dc25\` FOREIGN KEY (\`message_id\`) REFERENCES \`messages\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`message_statuses\` ADD CONSTRAINT \`FK_e8cd4c8e814448442e81c430b89\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`message_reactions\` ADD CONSTRAINT \`FK_ce61e365d81a9dfc15cd36513b0\` FOREIGN KEY (\`message_id\`) REFERENCES \`messages\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`message_reactions\` ADD CONSTRAINT \`FK_b6d3eda2f99b64016d6a4cf112f\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`messages\` ADD CONSTRAINT \`FK_3bc55a7c3f9ed54b520bb5cfe23\` FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversations\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`messages\` ADD CONSTRAINT \`FK_22133395bd13b970ccd0c34ab22\` FOREIGN KEY (\`sender_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`messages\` ADD CONSTRAINT \`FK_7f87cbb925b1267778a7f4c5d67\` FOREIGN KEY (\`reply_to_message_id\`) REFERENCES \`messages\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`conversations\` ADD CONSTRAINT \`FK_6e93e2251a9baafc3d56bfdded0\` FOREIGN KEY (\`created_by_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`notifications\` ADD CONSTRAINT \`FK_9a8a82462cab47c73d25f49261f\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`notifications\` DROP FOREIGN KEY \`FK_9a8a82462cab47c73d25f49261f\``);
        await queryRunner.query(`ALTER TABLE \`conversations\` DROP FOREIGN KEY \`FK_6e93e2251a9baafc3d56bfdded0\``);
        await queryRunner.query(`ALTER TABLE \`messages\` DROP FOREIGN KEY \`FK_7f87cbb925b1267778a7f4c5d67\``);
        await queryRunner.query(`ALTER TABLE \`messages\` DROP FOREIGN KEY \`FK_22133395bd13b970ccd0c34ab22\``);
        await queryRunner.query(`ALTER TABLE \`messages\` DROP FOREIGN KEY \`FK_3bc55a7c3f9ed54b520bb5cfe23\``);
        await queryRunner.query(`ALTER TABLE \`message_reactions\` DROP FOREIGN KEY \`FK_b6d3eda2f99b64016d6a4cf112f\``);
        await queryRunner.query(`ALTER TABLE \`message_reactions\` DROP FOREIGN KEY \`FK_ce61e365d81a9dfc15cd36513b0\``);
        await queryRunner.query(`ALTER TABLE \`message_statuses\` DROP FOREIGN KEY \`FK_e8cd4c8e814448442e81c430b89\``);
        await queryRunner.query(`ALTER TABLE \`message_statuses\` DROP FOREIGN KEY \`FK_229b8548ced91512c3d1f08dc25\``);
        await queryRunner.query(`ALTER TABLE \`conversation_users\` DROP FOREIGN KEY \`FK_8af317937c014db4135b1326958\``);
        await queryRunner.query(`ALTER TABLE \`conversation_users\` DROP FOREIGN KEY \`FK_f97c42b0b6d0b7cd6aa50a481db\``);
        await queryRunner.query(`ALTER TABLE \`friends\` DROP FOREIGN KEY \`FK_ad43e3c137c8548e461e1035c1c\``);
        await queryRunner.query(`ALTER TABLE \`friends\` DROP FOREIGN KEY \`FK_890c2646c24c98422c19969b199\``);
        await queryRunner.query(`ALTER TABLE \`user_profiles\` DROP FOREIGN KEY \`FK_6ca9503d77ae39b4b5a6cc3ba88\``);
        await queryRunner.query(`DROP INDEX \`IDX_310667f935698fcd8cb319113a\` ON \`notifications\``);
        await queryRunner.query(`DROP TABLE \`notifications\``);
        await queryRunner.query(`DROP TABLE \`conversations\``);
        await queryRunner.query(`DROP INDEX \`IDX_8584a1974e1ca95f4861d975ff\` ON \`messages\``);
        await queryRunner.query(`DROP TABLE \`messages\``);
        await queryRunner.query(`DROP INDEX \`IDX_f5a1f46b4f33ce416f9c192ab2\` ON \`message_reactions\``);
        await queryRunner.query(`DROP TABLE \`message_reactions\``);
        await queryRunner.query(`DROP INDEX \`IDX_aa29a73af33a25a7fba23c242c\` ON \`message_statuses\``);
        await queryRunner.query(`DROP TABLE \`message_statuses\``);
        await queryRunner.query(`DROP INDEX \`IDX_518dfc5846cc3bce09135801a9\` ON \`conversation_users\``);
        await queryRunner.query(`DROP TABLE \`conversation_users\``);
        await queryRunner.query(`DROP INDEX \`IDX_a9c6d3a04febb4c0913239752e\` ON \`friends\``);
        await queryRunner.query(`DROP TABLE \`friends\``);
        await queryRunner.query(`DROP INDEX \`REL_6ca9503d77ae39b4b5a6cc3ba8\` ON \`user_profiles\``);
        await queryRunner.query(`DROP INDEX \`IDX_6ca9503d77ae39b4b5a6cc3ba8\` ON \`user_profiles\``);
        await queryRunner.query(`DROP TABLE \`user_profiles\``);
    }

}
