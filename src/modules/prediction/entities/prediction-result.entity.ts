import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Prediction } from './prediction.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('prediction_results')
export class PredictionResult {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'prediction_id', type: 'uuid' })
    @Index('idx_prediction_result_prediction')
    predictionId: string;

    @Column({ name: 'user_id', type: 'uuid' })
    @Index('idx_prediction_result_user')
    userId: string;

    @Column({ name: 'total_score', type: 'integer' })
    totalScore: number;

    @Column({ type: 'jsonb' })
    details: Record<string, any>;

    @Column({ name: 'processed_at', type: 'timestamptz' })
    processedAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @ManyToOne(() => Prediction, (prediction) => prediction.results, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'prediction_id' })
    prediction: Prediction;

    @ManyToOne(() => User, (user) => user.predictionResults, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;
}
