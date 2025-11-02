import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RedisService } from './redis/redis.service';
import { SmsService } from './sms/sms.service';

@Global()
@Module({
    imports: [
        HttpModule,
        ClientsModule.registerAsync([
            {
                name: 'RABBITMQ_SERVICE',
                useFactory: () => ({
                    transport: Transport.RMQ,
                    options: {
                        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
                        queue: 'prediction.processing',
                        queueOptions: {
                            durable: true,
                        },
                    },
                }),
            },
        ]),
    ],
    providers: [RedisService, SmsService],
    exports: [RedisService, SmsService, ClientsModule],
})
export class SharedModule { }