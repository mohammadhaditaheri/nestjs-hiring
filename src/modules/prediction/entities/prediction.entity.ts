import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { PredictionResult } from './prediction-result.entity';

@Entity('predictions')
export class Prediction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id', type: 'uuid' })
    @Index('idx_prediction_user')
    userId: string;

    @Column({ type: 'jsonb' })
    @Index('idx_prediction_predict', { synchronize: false })
    predict: Record<string, any>;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @ManyToOne(() => User, (user) => user.predictions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @OneToMany(() => PredictionResult, (result) => result.prediction)
    results: PredictionResult[];
}
