import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    OneToMany,
} from 'typeorm';
import { Prediction } from '@/modules/prediction/entities/prediction.entity';
import { PredictionResult } from '@/modules/prediction/entities/prediction-result.entity';
import { UserSession } from './user-session.entity';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 15, unique: true })
    @Index('idx_user_phone')
    phone: string;

    @Column({ name: 'is_verified', type: 'boolean', default: false })
    isVerified: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @OneToMany(() => Prediction, (prediction) => prediction.user)
    predictions: Prediction[];

    @OneToMany(() => PredictionResult, (result) => result.user)
    predictionResults: PredictionResult[];

    @OneToMany(() => UserSession, (session) => session.user)
    sessions: UserSession[];
}
