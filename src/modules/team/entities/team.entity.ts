import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

@Entity('teams')
export class Team {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'fa_name', type: 'text' })
    faName: string;

    @Column({ name: 'eng_name', type: 'text' })
    engName: string;

    @Column({ type: 'integer', nullable: true })
    @Index('idx_team_order')
    order: number | null;

    @Column({ type: 'text', nullable: true })
    @Index('idx_team_group')
    group: string | null;

    @Column({ type: 'text' })
    flag: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}