import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { PredictionModule } from './modules/prediction/prediction.module';
import { TeamModule } from './modules/team/team.module';
import { SharedModule } from './shared/shared.module';
import { DatabaseConfig } from './config/database.config';
import { RedisConfig } from './config/redis.config';
import { RabbitMQConfig } from './config/rabbitmq.config';
import { AppConfig } from './config/app.config';
import { HealthController } from './shared/health/health.controller';

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            load: [AppConfig, DatabaseConfig, RedisConfig, RabbitMQConfig],
        }),

        // Database
        TypeOrmModule.forRootAsync({
            useFactory: DatabaseConfig,
            inject: [],
        }),

        // Rate limiting
        ThrottlerModule.forRoot([
            {
                ttl: 60000, // 1 minute
                limit: 10, // 10 requests per minute per IP
            },
        ]),

        // Feature modules
        SharedModule,
        AuthModule,
        TeamModule,
        PredictionModule,
    ],
    controllers: [HealthController],
    providers: [],
})
export class AppModule { }