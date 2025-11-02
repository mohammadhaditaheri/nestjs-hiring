import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PredictionController } from './prediction.controller';
import { PredictionService } from './prediction.service';
import { PredictionProcessor } from './prediction.processor';
import { AuthModule } from '../auth/auth.module';
import { TeamModule } from '../team/team.module';
import { Team } from '../team/entities/team.entity';
import { Prediction } from './entities/prediction.entity';
import { PredictionResult } from './entities/prediction-result.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Team, Prediction, PredictionResult]),
        AuthModule,
        TeamModule,
    ],
    controllers: [PredictionController, PredictionProcessor],
    providers: [PredictionService],
    exports: [PredictionService],
})
export class PredictionModule { }